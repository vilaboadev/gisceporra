"""
bot.py – Bot de Telegram per a la Lligueta de 2a Divisió (Hypermotion).

Modes:
  previa      – missatge de prèvia de jornada (per defecte)
  postjornada – missatge de resultats i punts de la jornada

Variables d'entorn (GitHub Secrets o .env):
  SUPABASE_URL          – URL del projecte Supabase  (compartit amb l'app web)
  SUPABASE_KEY          – clau anon/service_role      (compartit amb l'app web)
  TELEGRAM_BOT_TOKEN    – token del bot (@BotFather)
  TELEGRAM_CHAT_ID      – ID del grup / canal de Telegram
  BOT_MODE              – "previa" o "postjornada" (defecte: "previa")
  ROUND_NUMBER          – (opcional) número de jornada; si buit, detecció automàtica
"""

from __future__ import annotations

import os
import sys
import logging
import requests

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
# (mateixos secrets SUPABASE_URL / SUPABASE_KEY que usa l'app web)
# ---------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL       = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY       = os.environ.get("SUPABASE_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")
BOT_MODE           = os.environ.get("BOT_MODE", "previa").strip().lower()
ROUND_NUMBER       = os.environ.get("ROUND_NUMBER", "").strip()


# ---------------------------------------------------------------------------
# Connexió a Supabase
# ---------------------------------------------------------------------------
def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL o SUPABASE_KEY no configurats.")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Obtenció de dades
# ---------------------------------------------------------------------------
def fetch_current_round(client: Client) -> int:
    """Detecta la jornada en curs o retorna ROUND_NUMBER si s'ha especificat."""
    if ROUND_NUMBER:
        try:
            return int(ROUND_NUMBER)
        except ValueError:
            pass

    # Jornada mínima sense resultats (per a la prèvia)
    if BOT_MODE == "previa":
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
def main() -> None:
    log.info("Iniciant bot de la Lligueta de 2a Divisió (mode: %s)…", BOT_MODE)

    client = get_supabase_client()

    round_number = fetch_current_round(client)
    log.info("Jornada detectada: %s", round_number)

    matches = fetch_matches(client, round_number)
    if not matches:
        log.warning("No s'han trobat partits per a la jornada %s.", round_number)
        sys.exit(0)

    participants = fetch_participants(client)
    log.info("Participants carregats: %d", len(participants))

    rankings = fetch_rankings(client)
    log.info("Classificació carregada: %d jugadors", len(rankings))

    if BOT_MODE == "postjornada":
        predictions = fetch_predictions_for_round(client, round_number)
        log.info("Prediccions carregades: %d", len(predictions))
        # Per al post-jornada necessitem la classificació abans i després;
        # com que no emmagatzemem snapshots, passem rankings com a "after"
        # i calculem la "before" restant els punts guanyats aquesta jornada.
        rankings_before = _compute_rankings_before(rankings, matches, predictions)
        message = format_postjornada_message(
            round_number, matches, participants,
            rankings_before, rankings, predictions
        )
    else:
        message = format_prejornada_message(round_number, matches, participants, rankings)

    log.info("Missatge generat (%d caràcters).", len(message))
    send_telegram_message(message)


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

