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

from logic import format_prejornada_message, format_postjornada_message

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
            .select("match_key")
            .is_("home_goals", "null")
            .order("match_key")
            .limit(1)
            .execute()
        )
    else:
        # Post-jornada: la jornada màxima amb almenys un resultat
        resp = (
            client.table("hyper_results")
            .select("match_key")
            .not_.is_("home_goals", "null")
            .order("match_key", desc=True)
            .limit(1)
            .execute()
        )

    if resp.data:
        mk: str = resp.data[0]["match_key"]
        parts = mk.split("_")
        if parts[0].isdigit():
            return int(parts[0])

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


def _round_number_from_key(match_key: str) -> int | None:
    """Extreu el número de jornada d'un match_key amb format '{n}_...'."""
    parts = match_key.split("_")
    if parts[0].isdigit():
        return int(parts[0])
    return None


def detect_what_to_send(client: Client) -> list[tuple[str, int]]:
    """
    Mode "auto": analitza les dates dels partits i retorna la llista de
    missatges a enviar com a [(mode, round_number), ...].

    Lògica:
      - PRÈVIA: la jornada amb el primer partit sense resultat comença avui o demà
      - POST-JORNADA: la jornada amb tots els partits amb resultat ha acabat
        i l'últim partit va ser ahir o abans
    """
    today = date.today()
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)

    resp = (
        client.table("hyper_results")
        .select("match_key, match_date, home_goals, away_goals")
        .order("match_key")
        .execute()
    )
    all_matches = resp.data or []

    # Agrupar per jornada
    rounds: dict[int, list[dict]] = {}
    for m in all_matches:
        rn = _round_number_from_key(m.get("match_key", ""))
        if rn is not None:
            rounds.setdefault(rn, []).append(m)

    actions: list[tuple[str, int]] = []

    for rn, matches in sorted(rounds.items()):
        has_results = all(
            m.get("home_goals") is not None and m.get("away_goals") is not None
            for m in matches
        )
        no_results = all(
            m.get("home_goals") is None
            for m in matches
        )
        dates = [_parse_match_date(m) for m in matches]
        valid_dates = [d for d in dates if d is not None]

        if not valid_dates:
            continue

        first_match_date = min(valid_dates)
        last_match_date = max(valid_dates)

        # Prèvia: jornada pendent + primer partit avui o demà
        if no_results and first_match_date in (today, tomorrow):
            actions.append(("previa", rn))

        # Post-jornada: tots els partits resolts + l'últim va ser ahir o abans
        if has_results and last_match_date <= yesterday:
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
    """Partits de la jornada indicada (inclou home_goals i away_goals)."""
    prefix = f"{round_number}_"
    resp = (
        client.table("hyper_results")
        .select("match_key, home_team, away_team, match_date, home_goals, away_goals")
        .like("match_key", f"{prefix}%")
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
    """Prediccions de tots els jugadors per als partits de la jornada indicada."""
    prefix = f"{round_number}_"
    resp = (
        client.table("hyper_predictions")
        .select("username, match_key, pred_home, pred_away")
        .like("match_key", f"{prefix}%")
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
        sys.exit(1)


# ---------------------------------------------------------------------------
# Punt d'entrada principal
# ---------------------------------------------------------------------------
def _send_for_round(client: Client, mode: str, round_number: int) -> None:
    """Genera i envia el missatge per a una jornada i mode concret."""
    if already_sent(client, round_number, mode):
        log.info("Missatge '%s' jornada %s ja enviat. Saltant.", mode, round_number)
        return

    matches = fetch_matches(client, round_number)
    if not matches:
        log.warning("No s'han trobat partits per a la jornada %s.", round_number)
        return

    participants = fetch_participants(client)
    log.info("Participants carregats: %d", len(participants))

    rankings = fetch_rankings(client)
    log.info("Classificació carregada: %d jugadors", len(rankings))

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

    log.info("Missatge generat (%d caràcters).", len(message))
    send_telegram_message(message)
    mark_sent(client, round_number, mode)


def main() -> None:
    log.info("Iniciant bot de la Lligueta de 2a Divisió (mode: %s)…", BOT_MODE)

    client = get_supabase_client()

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

