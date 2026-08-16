"""
bot.py – Bot de Telegram per a la Lligueta de 2a Divisió (Hypermotion).

Flux principal:
  1. Llegeix de Supabase els partits de la jornada en curs.
  2. Consulta els participants i la classificació.
  3. Genera el missatge de pre-jornada amb l'ajuda de logic.py.
  4. Envia el missatge al grup de Telegram configurat.

Variables d'entorn necessàries (definides als Secrets de GitHub o a .env):
  SUPABASE_URL          – URL del projecte Supabase
  SUPABASE_KEY          – clau anon/service_role de Supabase
  TELEGRAM_BOT_TOKEN    – token del bot (obtingut a @BotFather)
  TELEGRAM_CHAT_ID      – ID del grup / canal de Telegram
  ROUND_NUMBER          – (opcional) número de jornada a processar;
                          si no s'especifica, s'intenta detectar automàticament
"""

from __future__ import annotations

import os
import sys
import logging
import requests

from dotenv import load_dotenv
from supabase import create_client, Client

from logic import format_prejornada_message

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
# ---------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
ROUND_NUMBER = os.environ.get("ROUND_NUMBER", "")


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
    """
    Detecta la jornada actual a partir dels partits de hyper_predictions
    o bé dels partits pendents a hyper_results.
    Retorna el número de jornada o 1 si no es pot determinar.
    """
    if ROUND_NUMBER:
        try:
            return int(ROUND_NUMBER)
        except ValueError:
            pass

    # Intentem llegir la jornada mínima sense resultats
    resp = (
        client.table("hyper_results")
        .select("match_key")
        .is_("home_goals", "null")
        .order("match_key")
        .limit(1)
        .execute()
    )
    if resp.data:
        # Les match_key solen tenir el format "<jornada>_<home>_<away>"
        mk: str = resp.data[0]["match_key"]
        parts = mk.split("_")
        if parts[0].isdigit():
            return int(parts[0])

    log.warning("No s'ha pogut detectar la jornada automàticament. S'usarà jornada 1.")
    return 1


def fetch_matches(client: Client, round_number: int) -> list[dict]:
    """
    Retorna els partits de la jornada indicada des de hyper_results.
    Si la taula no conté registres per a aquella jornada, torna llista buida.
    """
    prefix = f"{round_number}_"
    resp = (
        client.table("hyper_results")
        .select("match_key, home_team, away_team, match_date")
        .like("match_key", f"{prefix}%")
        .execute()
    )
    return resp.data or []


def fetch_participants(client: Client) -> list[dict]:
    """
    Retorna els participants de la lligueta Hypermotion.
    Filtra l'usuari de test 'TST' i els que no tinguin equip assignat.
    """
    resp = (
        client.table("participants")
        .select("username, display_name, hyper_team_id, nickname")
        .eq("porra_hyper", True)
        .neq("username", "TST")
        .execute()
    )
    return [p for p in (resp.data or []) if p.get("hyper_team_id")]


def fetch_rankings(client: Client) -> list[dict]:
    """
    Retorna la classificació de la lligueta Hypermotion (punts per jugador).

    Intenta llegir de la taula/vista ``hyper_clasificacion`` (si existeix).
    Si no, calcula els punts directament des de ``hyper_predictions`` i
    ``hyper_results`` (resultat exacte = 3 pts, signe correcte = 1 pt).
    """
    # Primer intentem la taula de cache Hypermotion
    try:
        resp = (
            client.table("hyper_clasificacion")
            .select("username, puntos")
            .order("puntos", desc=True)
            .execute()
        )
        if resp.data:
            participants_resp = (
                client.table("participants")
                .select("username, display_name, hyper_team_id")
                .eq("porra_hyper", True)
                .neq("username", "TST")
                .execute()
            )
            p_map = {p["username"]: p for p in (participants_resp.data or [])}
            rankings = []
            for r in resp.data:
                un = r.get("username", "")
                p = p_map.get(un, {})
                if p.get("hyper_team_id"):
                    rankings.append({
                        "username": un,
                        "display_name": p.get("display_name") or un,
                        "hyper_team_id": p.get("hyper_team_id", ""),
                        "puntos": r.get("puntos", 0),
                    })
            if rankings:
                return rankings
    except Exception:
        pass

    # Fallback: calcula punts des de predictions + results
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

    results_map: dict[str, dict] = {
        r["match_key"]: r for r in (results_resp.data or [])
    }

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
        elif (ph - pa) == (rh_g - ra_g) or \
             (ph > pa and rh_g > ra_g) or \
             (ph < pa and rh_g < ra_g) or \
             (ph == pa and rh_g == ra_g):
            scores[un] = scores.get(un, 0) + 1

    parts = fetch_participants(client)
    rankings = [
        {
            "username": p.get("username"),
            "display_name": p.get("display_name") or p.get("username"),
            "hyper_team_id": p.get("hyper_team_id"),
            "puntos": scores.get(p.get("username", ""), 0),
        }
        for p in parts
    ]
    rankings.sort(key=lambda x: x["puntos"], reverse=True)
    return rankings


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
    log.info("Iniciant bot de la Lligueta de 2a Divisió…")

    client = get_supabase_client()

    round_number = fetch_current_round(client)
    log.info("Jornada detectada: %s", round_number)

    matches = fetch_matches(client, round_number)
    if not matches:
        log.warning(
            "No s'han trobat partits per a la jornada %s. S'atura l'execució.", round_number
        )
        sys.exit(0)

    participants = fetch_participants(client)
    log.info("Participants carregats: %d", len(participants))

    rankings = fetch_rankings(client)
    log.info("Classificació carregada: %d jugadors", len(rankings))

    message = format_prejornada_message(round_number, matches, participants, rankings)
    log.info("Missatge generat (%d caràcters).", len(message))

    send_telegram_message(message)


if __name__ == "__main__":
    main()
