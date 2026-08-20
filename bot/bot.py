"""
bot.py – Bot de Telegram per a la Lligueta de 2a Divisió (Hypermotion).

Modes:
  auto        – detecció automàtica (per defecte): comprova si cal enviar prèvia
                o post-jornada basant-se en les dates dels partits de Supabase
  previa      – força el missatge de prèvia de jornada
  postjornada – força el missatge de resultats i punts de la jornada

Lògica automàtica (mode "auto"):
  - Cada dia el workflow executa el bot en mode "auto".
  - El bot detecta la jornada pròxima (partits sense resultat) i la acabada
    (tots els partits amb resultat).
  - Envia la PRÈVIA si el primer partit de la jornada comença AVUI o DEMÀ.
  - Envia el POST-JORNADA si l'últim partit de la jornada va acabar AHIR o ABANS
    i tots els partits de la jornada tenen resultat.
  - Safeguard: comprova la taula ``bot_sent_messages`` a Supabase per evitar
    enviar el mateix missatge més d'una vegada per jornada.

Variables d'entorn (GitHub Secrets o .env):
  SUPABASE_URL          – URL del projecte Supabase  (compartit amb l'app web)
  SUPABASE_ANON_KEY          – clau anon/service_role      (compartit amb l'app web)
  TELEGRAM_BOT_TOKEN    – token del bot (@BotFather)
  TELEGRAM_CHAT_ID      – ID del grup / canal de Telegram
  BOT_MODE              – "auto" | "previa" | "postjornada" (defecte: "auto")
  ROUND_NUMBER          – (opcional) número de jornada; si buit, detecció automàtica
  FORCE_SEND            – "true" per saltar el safeguard de duplicats
"""

from __future__ import annotations

import os
import sys
import logging
import requests
from datetime import date, timedelta

from dotenv import load_dotenv
from supabase import create_client, Client

from logic import load_schedule, get_jornada_from_date, format_prejornada_message, format_postjornada_message

# ---------------------------------------------------------------------------
# Configuració de logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Càrrega de variables d'entorn
# (mateixos secrets SUPABASE_URL / SUPABASE_ANON_KEY que usa l'app web)
# ---------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL       = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY  = os.environ.get("SUPABASE_ANON_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")
BOT_MODE           = os.environ.get("BOT_MODE", "auto").strip().lower()
ROUND_NUMBER       = os.environ.get("ROUND_NUMBER", "").strip()
FORCE_SEND         = os.environ.get("FORCE_SEND", "false").strip().lower() == "true"


# ---------------------------------------------------------------------------
# Connexió a Supabase
# ---------------------------------------------------------------------------
def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        log.error("SUPABASE_URL o SUPABASE_ANON_KEY no configurats.")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ---------------------------------------------------------------------------
# Obtenció de dades
# ---------------------------------------------------------------------------
def sync_hyper_results(client: Client) -> None:
    """Sincronitza només la finestra actual (-7 dies a +7 dies) des d'ESPN."""
    schedule = load_schedule("schedule.json")
    if not schedule:
        log.warning("No s'ha pogut carregar schedule.json per a la sincronització.")
        return

    today = date.today()
    start_date = (today - timedelta(days=7)).strftime("%Y%m%d")
    end_date = (today + timedelta(days=7)).strftime("%Y%m%d")

    # Petició lleugera: només 2 setmanes al voltant d'avui
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/esp.2/scoreboard?dates={start_date}-{end_date}&limit=50"

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        events = resp.json().get("events", [])

        rows = []
        for e in events:
            raw_date = e.get("date", "")
            date_str = raw_date[:10] if raw_date else None
            j_info = get_jornada_from_date(date_str, schedule)

            comp = e.get("competitions", [{}])[0]
            competitors = comp.get("competitors", [])
            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})

            status = e.get("status", {}).get("type", {})
            is_completed = status.get("completed") is True
            is_live = status.get("state") == "in"

            home_goals = int(home.get("score", 0)) if (is_completed or is_live) else None
            away_goals = int(away.get("score", 0)) if (is_completed or is_live) else None

            rows.append({
                "match_key": str(e.get("id")),
                "home_team": home.get("team", {}).get("name") or home.get("team", {}).get("displayName", ""),
                "away_team": away.get("team", {}).get("name") or away.get("team", {}).get("displayName", ""),
                "home_goals": home_goals,
                "away_goals": away_goals,
                "match_date": date_str,
                "jornada": j_info["jornada"]
            })

        if rows:
            client.table("hyper_results").upsert(rows, on_conflict="match_key").execute()
            log.info("Sincronització lleugera completada: %d partits actualitzats.", len(rows))

    except Exception as exc:
        log.error("Error en sincronització d'ESPN: %s", exc)

def fetch_current_round(client: Client, mode: str) -> int:
    """Detecta la jornada en curs o retorna ROUND_NUMBER si s'ha especificat."""
    if ROUND_NUMBER:
        try:
            return int(ROUND_NUMBER)
        except ValueError:
            pass

    # Jornada mínima sense resultats (per a la prèvia)
    if mode == "previa":
        resp = (
            client.table("hyper_results")
            .select("jornada")
            .is_("home_goals", "null")
            .not_.is_("jornada", "null")
            .order("jornada")
            .limit(1)
            .execute()
        )
    else:
        # Post-jornada: la jornada màxima amb almenys un resultat
        resp = (
            client.table("hyper_results")
            .select("jornada")
            .not_.is_("home_goals", "null")
            .not_.is_("jornada", "null")
            .order("jornada", desc=True)
            .limit(1)
            .execute()
        )

    if resp.data and resp.data[0].get("jornada") is not None:
        return int(resp.data[0]["jornada"])

    log.warning("No s'ha pogut detectar la jornada automàticament. S'usarà jornada 1.")
    return 1


def _parse_match_date(match: dict) -> date | None:
    """Extreu i parseja match_date (format 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM:SS') d'un partit."""
    raw = (match.get("match_date") or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None

def detect_what_to_send(client: Client) -> list[tuple[str, int]]:
    """
    Mode "auto": analitza les dates dels partits i retorna la llista de
    missatges a enviar com a [(mode, round_number), ...].

    Lògica:
      - PRÈVIA: jornada sense cap resultat on el primer partit comença avui o demà.
      - POST-JORNADA: 
          1. Tots els partits de la jornada tenen resultat (enviament immediat).
          2. O BÉ ja és dimarts/posterior a la data de l'últim partit (fallback per partits aplaçats).
    """
    today = date.today()
    max_preview_date = today + timedelta(days=3) # Dijous/Divendres veuen fins a Diumenge/Dilluns

    resp = (
        client.table("hyper_results")
        .select("jornada, match_date, home_goals, away_goals")
        .not_.is_("jornada", "null")
        .order("match_date")
        .execute()
    )
    all_matches = resp.data or []

    # Agrupar per jornada
    rounds: dict[int, list[dict]] = {}
    for m in all_matches:
        rn = m.get("jornada")
        if rn is not None:
            rounds.setdefault(int(rn), []).append(m)

    actions: list[tuple[str, int]] = []
    preview_added = False  # Flag per assegurar que NOMÉS afegim UNA prèvia

    for rn, matches in sorted(rounds.items()):
        total_partits_bdd = len(matches)
        is_tuesday_or_later = today.weekday() >= 1  # 0=Dilluns, 1=Dimarts...

        # Comprovem si TOTS els partits registrats d'aquesta jornada tenen resultat
        has_results = all(
            m.get("home_goals") is not None and m.get("away_goals") is not None
            for m in matches
        )

        # Comprovar si cap partit té resultat encara
        no_results = all(
            m.get("home_goals") is None and m.get("away_goals") is None
            for m in matches
        )

        dates = [_parse_match_date(m) for m in matches]
        valid_dates = [d for d in dates if d is not None]
        first_match_date = min(valid_dates) if valid_dates else None

        # ------------------------------------------------------------------
        # 1. PRÈVIA (Si la jornada existeix a la BDD sense resultats)
        # ------------------------------------------------------------------
        if no_results and first_match_date and (today <= first_match_date <= max_preview_date):
            if not preview_added and not already_sent(client, rn, "previa"):
                actions.append(("previa", rn))
                preview_added = True

        # ------------------------------------------------------------------
        # 2. POST-JORNADA:
        #    a) Condició ideal: Tots els partits s'han jugat (envia diumenge/dilluns al moment)
        #    b) Fallback: Ja és dimarts o posterior a la fi de la jornada (per partits aplaçats)
        # ------------------------------------------------------------------
        if has_results and total_partits_bdd == 11:
            # Condició ideal: Tenim els 11 partits amb resultat -> Enviem ja!
            if not already_sent(client, rn, "postjornada"):
                actions.append(("postjornada", rn))
        elif has_results and 0 < total_partits_bdd < 11 and is_tuesday_or_later:
            # Fallback: És dimarts o més tard, i no han arribat els 11 partits.
            # Donem la jornada per tancada amb els partits que tenim.
            if not already_sent(client, rn, "postjornada"):
                actions.append(("postjornada", rn))

    return actions


# ---------------------------------------------------------------------------
# Safeguard contra duplicats
# ---------------------------------------------------------------------------

def already_sent(client: Client, round_number: int, mode: str) -> bool:
    """Comprova si ja s'ha enviat el missatge per a aquesta jornada i mode."""
    if FORCE_SEND:
        return False
    try:
        resp = (
            client.table("bot_sent_messages")
            .select("id")
            .eq("jornada", round_number)
            .eq("mode", mode)
            .limit(1)
            .execute()
        )
        return bool(resp.data)
    except Exception as exc:
        log.warning("No s'ha pogut consultar bot_sent_messages: %s. Es continuarà.", exc)
        return False


def mark_sent(client: Client, round_number: int, mode: str) -> None:
    """Registra que s'ha enviat el missatge per a aquesta jornada i mode."""
    try:
        client.table("bot_sent_messages").insert(
            {"jornada": round_number, "mode": mode},
        ).execute()
        log.info("Registrat enviament: jornada=%s mode=%s", round_number, mode)
    except Exception as exc:
        log.warning("No s'ha pogut registrar a bot_sent_messages: %s", exc)


def fetch_matches(client: Client, round_number: int) -> list[dict]:
    """Partits de la jornada indicada, filtrant per la columna jornada."""
    resp = (
        client.table("hyper_results")
        .select("match_key, home_team, away_team, match_date, home_goals, away_goals")
        .eq("jornada", round_number)
        .order("match_date")
        .execute()
    )
    return resp.data or []


def fetch_participants(client: Client) -> list[dict]:
    """Participants de la lligueta Hypermotion (sense TST ni sense equip)."""
    resp = (
        client.table("participants")
        .select("username, display_name, hyper_team_id, nickname, telegram_handle")
        .eq("porra_hyper", True)
        .neq("username", "TST")
        .execute()
    )
    return [p for p in (resp.data or []) if p.get("hyper_team_id")]


def fetch_rankings(client: Client) -> list[dict]:
    """
    Classificació Hypermotion.

    Ordre de prioritat:
    1. Vista/taula ``hyper_clasificacion`` (si existeix i té dades).
    2. Càlcul en temps real des de ``hyper_predictions`` + ``hyper_results``.
    """
    try:
        resp = (
            client.table("hyper_clasificacion")
            .select("username, puntos")
            .order("puntos", desc=True)
            .execute()
        )
        if resp.data:
            parts_resp = (
                client.table("participants")
                .select("username, display_name, hyper_team_id, telegram_handle")
                .eq("porra_hyper", True)
                .neq("username", "TST")
                .execute()
            )
            p_map = {p["username"]: p for p in (parts_resp.data or [])}
            rankings = []
            for r in resp.data:
                un = r.get("username", "")
                p = p_map.get(un, {})
                if p.get("hyper_team_id"):
                    rankings.append({
                        "username": un,
                        "display_name": p.get("display_name") or un,
                        "hyper_team_id": p.get("hyper_team_id", ""),
                        "telegram_handle": p.get("telegram_handle", ""),
                        "puntos": r.get("puntos", 0),
                    })
            if rankings:
                return rankings
    except Exception:
        pass

    # Fallback: càlcul des de predictions + results
    log.info("Calculant classificació Hypermotion des de hyper_predictions + hyper_results…")
    preds_resp = (
        client.table("hyper_predictions")
        .select("username, match_key, pred_home, pred_away")
        .execute()
    )
    results_resp = (
        client.table("hyper_results")
        .select("match_key, home_goals, away_goals")
        .not_.is_("home_goals", "null")
        .execute()
    )
    results_map = {r["match_key"]: r for r in (results_resp.data or [])}

    scores: dict[str, int] = {}
    for pred in (preds_resp.data or []):
        mk = pred.get("match_key", "")
        result = results_map.get(mk)
        if not result:
            continue
        ph = pred.get("pred_home")
        pa = pred.get("pred_away")
        rh_g = result.get("home_goals")
        ra_g = result.get("away_goals")
        if ph is None or pa is None or rh_g is None or ra_g is None:
            continue
        un = pred.get("username", "")
        if ph == rh_g and pa == ra_g:
            scores[un] = scores.get(un, 0) + 3
        elif (ph > pa and rh_g > ra_g) or (ph < pa and rh_g < ra_g) or (ph == pa and rh_g == ra_g):
            scores[un] = scores.get(un, 0) + 1

    parts = fetch_participants(client)
    rankings = [
        {
            "username": p.get("username"),
            "display_name": p.get("display_name") or p.get("username"),
            "hyper_team_id": p.get("hyper_team_id"),
            "telegram_handle": p.get("telegram_handle", ""),
            "puntos": scores.get(p.get("username", ""), 0),
        }
        for p in parts
    ]
    rankings.sort(key=lambda x: x["puntos"], reverse=True)
    return rankings


def fetch_predictions_for_round(client: Client, round_number: int) -> list[dict]:
    """Prediccions de tots els jugadors per als partits de la jornada indicada, filtrant per match_date."""
    matches = fetch_matches(client, round_number)
    if not matches:
        return []
    match_keys = [m["match_key"] for m in matches if m.get("match_key")]
    if not match_keys:
        return []
    resp = (
        client.table("hyper_predictions")
        .select("username, match_key, pred_home, pred_away")
        .in_("match_key", match_keys)
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# Enviament a Telegram
# ---------------------------------------------------------------------------
def send_telegram_message(text: str) -> None:
    """Envia un missatge al grup de Telegram configurat."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log.error("TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurats.")
        sys.exit(1)

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        resp = requests.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        log.info("Missatge enviat correctament a Telegram.")
    except requests.RequestException as exc:
        log.error("Error en enviar el missatge a Telegram: %s", exc)
        # Mostra el detall exacte de l'error que retorna Telegram
        if hasattr(exc, "response") and exc.response is not None:
            log.error("Detall de la resposta de Telegram API: %s", exc.response.text)
        sys.exit(1)


def _send_for_round(client: Client, mode: str, round_number: int) -> None:
    """Genera i envia el missatge per a una jornada i mode concret."""
    
    # 1. Safeguard de duplicats (tret que FORCE_SEND sigui True)
    if str(FORCE_SEND).lower() != "true" and already_sent(client, round_number, mode):
        log.info("Missatge '%s' jornada %s ja enviat anteriorment. Saltant.", mode, round_number)
        return

    # 2. Carregar els partits de la jornada des de Supabase
    matches = fetch_matches(client, round_number)
    if not matches:
        log.warning("No s'han trobat partits a la BDD per a la jornada %s.", round_number)
        return

    # 3. CANDAU DE SEGURETAT PER A POST-JORNADA (Aplica a 'auto' i manual)
    if mode == "postjornada" and str(FORCE_SEND).lower() != "true":
        total_partits = len(matches)
        
        # Tots els partits registrats tenen resultat definitiu?
        partits_completats = all(
            m.get("home_goals") is not None and m.get("away_goals") is not None
            for m in matches
        )
        
        # Comprovació del dia de la setmana (0=Dilluns, 1=Dimarts, ..., 6=Diumenge)
        is_tuesday_or_later = date.today().weekday() >= 1

        # Si hi ha partits a la BDD que encara no tenen gols registrats
        if not partits_completats:
            log.warning(
                "CANCEL·LAT: Queden partits registrats a la BDD per a la jornada %s sense resultat.",
                round_number
            )
            return

        # Si hi ha menys d'11 partits registrats i encara és dilluns o cap de setmana
        if total_partits < 11 and not is_tuesday_or_later:
            log.warning(
                "CANCEL·LAT: S'ha intentat enviar el POST-JORNADA per a la jornada %s, però només "
                "hi ha %d/11 partits a la BDD i encara és dilluns (o cap de setmana). "
                "S'esperarà a dimarts per donar la jornada per tancada.",
                round_number, total_partits
            )
            return

    # 4. Carregar participants i classificació
    participants = fetch_participants(client)
    log.info("Participants carregats: %d", len(participants))

    rankings = fetch_rankings(client)
    log.info("Classificació carregada: %d jugadors", len(rankings))

    # 5. Formatar el missatge segons el mode
    if mode == "postjornada":
        predictions = fetch_predictions_for_round(client, round_number)
        log.info("Prediccions carregades: %d", len(predictions))
        rankings_before = _compute_rankings_before(rankings, matches, predictions)
        message = format_postjornada_message(
            round_number, matches, participants,
            rankings_before, rankings, predictions
        )
    else:
        message = format_prejornada_message(round_number, matches, participants, rankings)

    # 6. Enviament i registre
    log.info("Missatge generat (%d caràcters). Enviant a Telegram...", len(message))
    send_telegram_message(message)
    mark_sent(client, round_number, mode)


# ---------------------------------------------------------------------------
# Punt d'entrada principal
# ---------------------------------------------------------------------------
def main() -> None:
    log.info("Iniciant bot de la Lligueta de 2a Divisió (mode: %s)…", BOT_MODE)

    client = get_supabase_client()

    # 1. PAS CLAU: Manteniment automàtic de la taula hyper_results
    log.info("Sincronitzant partits d'ESPN amb Supabase...")
    sync_hyper_results(client)

    # 2. Execució normal del bot
    if BOT_MODE == "auto":
        # Detecció intel·ligent: envia prèvia/post-jornada segons les dates
        actions = detect_what_to_send(client)
        if not actions:
            log.info("Mode auto: cap missatge a enviar avui.")
            return
        for mode, round_number in actions:
            log.info("Mode auto → enviant '%s' per jornada %s", mode, round_number)
            _send_for_round(client, mode, round_number)
    else:
        # Mode explicit (previa / postjornada)
        round_number = fetch_current_round(client, BOT_MODE)
        log.info("Jornada detectada: %s", round_number)
        _send_for_round(client, BOT_MODE, round_number)


def _compute_rankings_before(
    rankings_after: list[dict],
    matches: list[dict],
    predictions: list[dict],
) -> list[dict]:
    """
    Estima la classificació ABANS de la jornada restant els punts guanyats.
    Útil quan no hi ha snapshot previ emmagatzemat.
    """
    from logic import _score_prediction

    results_map = {m["match_key"]: m for m in matches if m.get("home_goals") is not None}
    pred_map = {
        (p["username"], p["match_key"]): p
        for p in predictions
    }

    before = []
    for r in rankings_after:
        un = r.get("username", "")
        pts_earned = 0
        for mk, match in results_map.items():
            pred = pred_map.get((un, mk))
            if not pred:
                continue
            ph = pred.get("pred_home")
            pa = pred.get("pred_away")
            rh = match.get("home_goals")
            ra = match.get("away_goals")
            if ph is not None and pa is not None and rh is not None and ra is not None:
                pts_earned += _score_prediction(ph, pa, rh, ra)[0]
        before.append({**r, "puntos": max(0, (r.get("puntos") or 0) - pts_earned)})
    before.sort(key=lambda x: x["puntos"], reverse=True)
    return before


if __name__ == "__main__":
    main()

