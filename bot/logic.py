"""
logic.py – Intel·ligència del bot de la Lligueta de 2a Divisió.

Funcions pures (sense efectes secundaris) per detectar:
  - Duels directes entre companys de la lligueta
  - Derbis geogràfics
  - Context de classificació (líder vs cuer, rivals directes…)
  - Missatges de pre-jornada i post-jornada

Format dels participants:
  username, display_name, hyper_team_id, telegram_handle (ex: "@pere")

Format dels partits (matches):
  home_team, away_team, match_date, match_time,
  home_goals (None si no jugat), away_goals (None si no jugat)

Format de les prediccions (predictions):
  username, match_key, pred_home, pred_away

Format dels rankings:
  username, display_name, hyper_team_id, puntos
"""

from __future__ import annotations

import random

# ---------------------------------------------------------------------------
# Mapeig d'equips Hypermotion (ID ESPN -> Dades i Àlies)
# ---------------------------------------------------------------------------
HYPER_TEAMS_BY_ID: dict[str, dict] = {
    "5404": {"key": "Ceuta", "region": "Ceuta", "aliases": ["ceuta", "ad ceuta fc"]},
    "2737": {"key": "Albacete", "region": "Castella-la Manxa", "aliases": ["albacete", "albacete bp"]},
    "12597": {"key": "Burgos", "region": "Castella i Lleó", "aliases": ["burgos", "burgos cf"]},
    "3842": {"key": "Cadiz", "region": "Andalusia", "aliases": ["cadiz", "cádiz", "cádiz cf", "cadiz cf"]},
    "4438": {"key": "Castellon", "region": "Comunitat Valenciana", "aliases": ["castellon", "castellón", "cd castellón", "cd castellon"]},
    "7320": {"key": "Eldense", "region": "Comunitat Valenciana", "aliases": ["eldense", "cd eldense"]},
    "17534": {"key": "Leganes", "region": "Madrid", "aliases": ["leganes", "leganés", "cd leganés", "cd leganes"]},
    "245": {"key": "Tenerife", "region": "Canàries", "aliases": ["tenerife", "cd tenerife"]},
    "11487": {"key": "Sabadell", "region": "Catalunya", "aliases": ["sabadell", "ce sabadell"]},
    "131858": {"key": "Celta Fortuna", "region": "Galícia", "aliases": ["celta fortuna", "rc celta fortuna"]},
    "8447": {"key": "Cordoba", "region": "Andalusia", "aliases": ["cordoba", "còrdova", "córdoba cf", "cordoba cf"]},
    "20179": {"key": "Andorra", "region": "Catalunya", "aliases": ["andorra", "fc andorra"]},
    "9812": {"key": "Girona", "region": "Catalunya", "aliases": ["girona", "girona fc"]},
    "3747": {"key": "Granada", "region": "Andalusia", "aliases": ["granada", "granada cf"]},
    "20983": {"key": "Real Sociedad B", "region": "País Basc", "aliases": ["real sociedad b", "real sociedad ii", "real sociedad 2"]},
    "84": {"key": "Mallorca", "region": "Illes Balears", "aliases": ["mallorca", "rcd mallorca"]},
    "92": {"key": "Oviedo", "region": "Astúries", "aliases": ["oviedo", "real oviedo"]},
    "3788": {"key": "Sporting", "region": "Astúries", "aliases": ["sporting", "real sporting", "sporting de gijón"]},
    "95": {"key": "Valladolid", "region": "Castella i Lleó", "aliases": ["valladolid", "real valladolid", "real valladolid cf"]},
    "3752": {"key": "Eibar", "region": "País Basc", "aliases": ["eibar", "sd eibar"]},
    "6832": {"key": "Almeria", "region": "Andalusia", "aliases": ["almeria", "almería", "ud almería", "ud almeria"]},
    "98": {"key": "Las Palmas", "region": "Canàries", "aliases": ["las palmas", "ud las palmas"]},
}

# Índex auxiliar per traduir qualsevol nom, àlies o ID al seu ID d'ESPN únic
NAME_OR_ID_TO_ESPN_ID: dict[str, str] = {}
for espn_id, data in HYPER_TEAMS_BY_ID.items():
    NAME_OR_ID_TO_ESPN_ID[espn_id] = espn_id
    NAME_OR_ID_TO_ESPN_ID[data["key"].lower()] = espn_id
    for alias in data["aliases"]:
        NAME_OR_ID_TO_ESPN_ID[alias.lower()] = espn_id


def get_espn_id(team_identifier: str | None) -> str | None:
    """Retorna l'ID d'ESPN a partir d'un nom d'equip, àlies o ID."""
    if not team_identifier:
        return None
    clean = str(team_identifier).strip().lower()
    return NAME_OR_ID_TO_ESPN_ID.get(clean)


def get_team_region(team_identifier: str | None) -> str | None:
    """Obté la comunitat autònoma a partir de l'ID o nom de l'equip."""
    espn_id = get_espn_id(team_identifier)
    if espn_id and espn_id in HYPER_TEAMS_BY_ID:
        return HYPER_TEAMS_BY_ID[espn_id]["region"]
    return None


# ---------------------------------------------------------------------------
# Missatges i taunts
# ---------------------------------------------------------------------------

DERBY_TAUNTS: dict[str, list[str]] = {
    "Andalusia": [
        "Duelo andalús d'urgències. El que perd, la rodada de tapes la paga.",
        "Sol, platja i tres punts. Qui porta el millor flamenc al camp? 💃",
    ],
    "País Basc": [
        "Derbi basc! Txakoli a punt per celebrar. Aupa!",
        "La ikurriña té un sol color preferit avui vespre.",
    ],
    "Astúries": [
        "Derbi asturià! El carbó encén les passions al Principat.",
        "Sidra i punts: només n'hi ha prou per a un dels dos. Salut! 🍏",
    ],
    "Catalunya": [
        "Derbi català! La pedrera contra el camp gran. Forza!",
        "La Rosa de Sant Jordi va per als tres punts, no per dividir-los.",
    ],
    "Canàries": [
        "Derbi canari! Tenerife vs Gran Canaria: l'etern volcà enfront de la duna. 🌋",
        "Qui guanya governa l'arxipèlag futbolístic per una setmana més.",
    ],
    "Castella i Lleó": [
        "Derbi castellà! Mesetes àrides, però el futbol és molt calent.",
    ],
    "Comunitat Valenciana": [
        "Derbi valencianista! La paella es cuina amb tres punts. 🍊",
        "Taronges i rivalitat: la combinació perfecta del Llevant.",
    ],
}

DUEL_CONTEXT_TAUNTS: list[str] = [
    "Partit de 6 punts clau! {a} ({pos_a}è, {pts_a} pts) i {b} ({pos_b}è, {pts_b} pts) s'hi juguen molt.",
    "{a} defensa la seva posició a casa i {b} busca assaltar-la. Qui parpelleja primer?",
    "Diferència de {diff} pt(s) a la taula. El que guanya s'endú el duel directe de la lligueta.",
    "Directe entre els dos! {a} ({pts_a} pts) i {b} ({pts_b} pts). La tensió és màxima.",
]

RESULT_EXACT = "🎯"
RESULT_SIGN  = "🟡"
RESULT_WRONG = "❌"

POST_DUEL_COMMENTS: list[str] = [
    "Victòria i ple de {winner} que s'endú el duel directe!",
    "{winner} guanya el mà a mà de la lligueta. {loser} haurà d'esperar revanxa.",
    "Gran nit per a {winner}. {loser} se'n va de buit del derby particular.",
    "{loser} cau en el duel directe. {winner} amplia distàncies a la taula.",
]

POST_DUEL_DRAW_COMMENTS: list[str] = [
    "Empat en el duel directe. Cap dels dos avança a la taula, segueixen els dos igual.",
    "Repartiment de punts en el mà a mà. La lligueta segueix ben oberta.",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _esc(text: str) -> str:
    """Escapa caràcters especials d'HTML per a noms dinàmics."""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _handle(participant: dict) -> str:
    """Retorna el @handle de Telegram o el display_name si no n'hi ha."""
    h = (participant.get("telegram_handle") or "").strip()
    if h:
        return h if h.startswith("@") else f"@{h}"
    return _esc(participant.get("display_name") or participant.get("username", "?"))


def _build_espn_id_to_player(participants: list[dict]) -> dict[str, dict]:
    """Mapeja l'ID d'ESPN de l'equip al perfil del jugador."""
    m: dict[str, dict] = {}
    for p in participants:
        espn_id = get_espn_id(p.get("hyper_team_id"))
        if espn_id:
            m[espn_id] = p
    return m


def _score_prediction(
    pred_home: int, pred_away: int, real_home: int, real_away: int
) -> tuple[int, str]:
    """Retorna (punts, emoji)."""
    if pred_home == real_home and pred_away == real_away:
        return 3, RESULT_EXACT
    pred_sign = (pred_home > pred_away) - (pred_home < pred_away)
    real_sign = (real_home > real_away) - (real_home < real_away)
    if pred_sign == real_sign:
        return 1, RESULT_SIGN
    return 0, RESULT_WRONG


# ---------------------------------------------------------------------------
# Detecció de duels i derbis
# ---------------------------------------------------------------------------

def detect_direct_duels(
    matches: list[dict],
    participants: list[dict],
) -> list[dict]:
    """Detecta duels directes entre companys de la lligueta."""
    t2p = _build_espn_id_to_player(participants)
    duels = []
    for match in matches:
        home_espn_id = get_espn_id(match.get("home_team"))
        away_espn_id = get_espn_id(match.get("away_team"))
        
        ph = t2p.get(home_espn_id) if home_espn_id else None
        pa = t2p.get(away_espn_id) if away_espn_id else None
        
        if ph and pa:
            duels.append({"match": match, "player_home": ph, "player_away": pa})
    return duels


def detect_derbies(matches: list[dict]) -> list[dict]:
    """Detecta derbis geogràfics entre equips de la mateixa comunitat."""
    derbies = []
    for match in matches:
        rh = get_team_region(match.get("home_team"))
        ra = get_team_region(match.get("away_team"))
        if rh and rh == ra:
            taunts = DERBY_TAUNTS.get(rh, [f"Derbi de {rh}!"])
            derbies.append({"match": match, "region": rh, "taunt": random.choice(taunts)})
    return derbies


# ---------------------------------------------------------------------------
# Context de classificació per a un duel directe (prèvia)
# ---------------------------------------------------------------------------

def _duel_context(
    player_home: dict,
    player_away: dict,
    rankings: list[dict],
) -> str:
    """Genera el text de context per a un duel directe a la prèvia."""
    rank_map = {
        (r.get("username") or ""): (idx + 1, r.get("puntos", 0))
        for idx, r in enumerate(rankings)
    }
    u_h = player_home.get("username", "")
    u_a = player_away.get("username", "")
    pos_h, pts_h = rank_map.get(u_h, (0, 0))
    pos_a, pts_a = rank_map.get(u_a, (0, 0))
    diff = abs(pts_h - pts_a)

    handle_h = _handle(player_home)
    handle_a = _handle(player_away)

    return random.choice(DUEL_CONTEXT_TAUNTS).format(
        a=handle_h, b=handle_a,
        pos_a=pos_h, pts_a=pts_h,
        pos_b=pos_a, pts_b=pts_a,
        diff=diff,
    )


# ---------------------------------------------------------------------------
# Missatge de PRÈVIA
# ---------------------------------------------------------------------------

def format_prejornada_message(
    round_number: int,
    matches: list[dict],
    participants: list[dict],
    rankings: list[dict],
) -> str:
    """Genera el missatge de prèvia de jornada per a Telegram (HTML)."""
    t2p = _build_espn_id_to_player(participants)
    derby_set = {id(m["match"]) for m in detect_derbies(matches)}

    featured: list[dict] = []
    rest: list[dict] = []

    for match in matches:
        home_espn_id = get_espn_id(match.get("home_team"))
        away_espn_id = get_espn_id(match.get("away_team"))
        
        ph = t2p.get(home_espn_id) if home_espn_id else None
        pa = t2p.get(away_espn_id) if away_espn_id else None
        
        is_duel = bool(ph and pa)
        is_derby = id(match) in derby_set

        if is_duel or is_derby:
            featured.append({
                "match": match, "player_home": ph, "player_away": pa,
                "is_duel": is_duel, "is_derby": is_derby
            })
        else:
            rest.append({"match": match, "player_home": ph, "player_away": pa})

    lines: list[str] = []
    lines.append(f"🚨 <b>PRÈVIA JORNADA {round_number}</b> 🚨")
    lines.append("")

    # --- Partits destacats ---
    for item in featured:
        m = item["match"]
        home_name = _esc(m.get("home_team", "?"))
        away_name = _esc(m.get("away_team", "?"))
        ph = item["player_home"]
        pa = item["player_away"]

        home_label = f"{home_name} ({_handle(ph)})" if ph else home_name
        away_label = f"{away_name} ({_handle(pa)})" if pa else away_name

        lines.append(f"🔥 <b>{home_label} 🆚 {away_label}</b>")

        if item["is_duel"] and ph and pa:
            ctx = _duel_context(ph, pa, rankings)
            lines.append(f"  {ctx}")

        if item["is_derby"]:
            derby_info = next(
                (d for d in detect_derbies([m]) if d["match"] is m), None
            )
            if derby_info:
                lines.append(f"  🏟️ {_esc(derby_info['taunt'])}")

        lines.append("")

    # --- La resta de la tropa ---
    if rest:
        lines.append("⚽ <b>LA RESTA DE LA TROPA:</b>")
        for item in rest:
            m = item["match"]
            home_name = _esc(m.get("home_team", "?"))
            away_name = _esc(m.get("away_team", "?"))
            ph = item["player_home"]
            pa = item["player_away"]

            parts_str = ""
            if ph and not pa:
                parts_str = f" ({_handle(ph)})"
            elif pa and not ph:
                parts_str = f" ({_handle(pa)})"

            lines.append(f"  • {home_name} vs {away_name}{parts_str}")
        lines.append("")

    lines.append(
        "📊 <i>Recordeu que teniu fins a 1 hora abans del vostre partit respectiu "
        "per revisar i guardar les prediccions a la web!</i>"
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Missatge de POST-JORNADA
# ---------------------------------------------------------------------------

def format_postjornada_message(
    round_number: int,
    matches: list[dict],
    participants: list[dict],
    rankings_before: list[dict],
    rankings_after: list[dict],
    predictions: list[dict],
) -> str:
    """Genera el missatge de resultats post-jornada per a Telegram (HTML)."""
    t2p = _build_espn_id_to_player(participants)

    pred_map: dict[tuple[str, str], dict] = {}
    for pred in predictions:
        key = (pred.get("username", ""), pred.get("match_key", ""))
        pred_map[key] = pred

    played = [
        m for m in matches
        if m.get("home_goals") is not None and m.get("away_goals") is not None
    ]

    if not played:
        return (
            f"🏁 <b>RESULTATS JORNADA {round_number}</b> 🏁\n\n"
            "<i>Encara no hi ha resultats disponibles.</i>"
        )

    derby_matches = {id(m["match"]) for m in detect_derbies(played)}
    featured: list[dict] = []
    rest: list[dict] = []

    for match in played:
        home_espn_id = get_espn_id(match.get("home_team"))
        away_espn_id = get_espn_id(match.get("away_team"))

        ph = t2p.get(home_espn_id) if home_espn_id else None
        pa = t2p.get(away_espn_id) if away_espn_id else None

        is_duel = bool(ph and pa)
        is_derby = id(match) in derby_matches
        entry = {
            "match": match, "player_home": ph, "player_away": pa,
            "is_duel": is_duel, "is_derby": is_derby,
        }
        if is_duel or is_derby:
            featured.append(entry)
        else:
            rest.append(entry)

    lines: list[str] = []
    lines.append(f"🏁 <b>RESULTATS JORNADA {round_number}</b> 🏁")
    lines.append("")

    def _match_result_line(match: dict, ph: dict | None, pa: dict | None) -> list[str]:
        mk = match.get("match_key", "")
        rh = match.get("home_goals", 0)
        ra = match.get("away_goals", 0)
        result_str = f"{rh}-{ra}"
        result_lines = [f"  Resultat real: <b>{result_str}</b>"]

        for player in [ph, pa]:
            if not player:
                continue
            un = player.get("username", "")
            pred = pred_map.get((un, mk))
            if pred is None:
                continue
            ph_pred = pred.get("pred_home")
            pa_pred = pred.get("pred_away")
            if ph_pred is None or pa_pred is None:
                continue
            pts, emoji = _score_prediction(ph_pred, pa_pred, rh, ra)
            handle = _handle(player)
            result_lines.append(
                f"  {handle}: {ph_pred}-{pa_pred} ({'+' if pts > 0 else ''}{pts} pts {emoji})"
            )
        return result_lines

    # --- Partits destacats ---
    for item in featured:
        m = item["match"]
        home_name = _esc(m.get("home_team", "?"))
        away_name = _esc(m.get("away_team", "?"))
        ph = item["player_home"]
        pa = item["player_away"]

        home_label = f"{home_name} ({_handle(ph)})" if ph else home_name
        away_label = f"{away_name} ({_handle(pa)})" if pa else away_name
        lines.append(f"🔥 <b>{home_label} 🆚 {away_label}</b>")

        for rl in _match_result_line(m, ph, pa):
            lines.append(rl)

        if item["is_duel"] and ph and pa:
            rh = m.get("home_goals", 0)
            ra = m.get("away_goals", 0)
            mk = m.get("match_key", "")
            pred_h = pred_map.get((ph.get("username", ""), mk))
            pred_a = pred_map.get((pa.get("username", ""), mk))

            pts_h = (
                _score_prediction(pred_h["pred_home"], pred_h["pred_away"], rh, ra)[0]
                if pred_h and pred_h.get("pred_home") is not None and pred_h.get("pred_away") is not None
                else 0
            )
            pts_a = (
                _score_prediction(pred_a["pred_home"], pred_a["pred_away"], rh, ra)[0]
                if pred_a and pred_a.get("pred_home") is not None and pred_a.get("pred_away") is not None
                else 0
            )

            handle_h = _handle(ph)
            handle_a = _handle(pa)

            if rh > ra:
                winner_handle, loser_handle = handle_h, handle_a
            elif ra > rh:
                winner_handle, loser_handle = handle_a, handle_h
            else:
                winner_handle, loser_handle = None, None

            if winner_handle:
                comment = random.choice(POST_DUEL_COMMENTS).format(
                    winner=winner_handle, loser=loser_handle
                )
                if pts_h != pts_a:
                    best_handle = handle_h if pts_h >= pts_a else handle_a
                    worst_handle = handle_a if pts_h >= pts_a else handle_h
                    comment += f" {best_handle} salva {pts_h if pts_h >= pts_a else pts_a} pt(s); {worst_handle} se'n va amb {min(pts_h, pts_a)}."
                lines.append(f"  <i>{comment}</i>")
            else:
                lines.append(f"  <i>{random.choice(POST_DUEL_DRAW_COMMENTS)}</i>")

        lines.append("")

    # --- La resta de la tropa ---
    if rest:
        lines.append("⚽ <b>LA RESTA DE LA TROPA:</b>")
        for item in rest:
            m = item["match"]
            home_name = _esc(m.get("home_team", "?"))
            away_name = _esc(m.get("away_team", "?"))
            ph = item["player_home"]
            pa = item["player_away"]
            rh = m.get("home_goals", 0)
            ra = m.get("away_goals", 0)
            mk = m.get("match_key", "")

            player = ph or pa
            if ph and pa:
                part_label = f"{home_name} ({_handle(ph)}) vs {away_name} ({_handle(pa)})"
            elif player:
                handle = _handle(player)
                part_label = f"{home_name} vs {away_name} ({handle})"
            else:
                part_label = f"{home_name} vs {away_name}"

            result_str = f"Real <b>{rh}-{ra}</b>"

            pred_parts: list[str] = []
            for p in [ph, pa]:
                if not p:
                    continue
                un = p.get("username", "")
                pred = pred_map.get((un, mk))
                if not pred:
                    continue
                ph_p = pred.get("pred_home")
                pa_p = pred.get("pred_away")
                if ph_p is None or pa_p is None:
                    continue
                pts, emoji = _score_prediction(ph_p, pa_p, rh, ra)
                pred_parts.append(f"Pronòstic: {ph_p}-{pa_p} ({'+' if pts > 0 else ''}{pts} pts {emoji})")

            suffix = " | ".join([result_str] + pred_parts)
            lines.append(f"  • {part_label}: {suffix}")
        lines.append("")

    # --- Estat de la lligueta ---
    if rankings_after:
        lines.append("📊 <b>ESTAT DE LA LLIGUETA:</b>")

        top3 = rankings_after[:3]
        bottom3 = rankings_after[-3:] if len(rankings_after) > 3 else []

        top3_parts = [
            f"{idx + 1}r {_handle(r)} ({r.get('puntos', 0)} pts)"
            for idx, r in enumerate(top3)
        ]
        lines.append(f"  • Top 3: {' | '.join(top3_parts)}")

        if bottom3:
            total = len(rankings_after)
            bottom3_parts = [
                f"{total - len(bottom3) + idx + 1}è {_handle(r)} ({r.get('puntos', 0)} pts)"
                for idx, r in enumerate(bottom3)
            ]
            lines.append(f"  • Cua: {' | '.join(bottom3_parts)}")

    return "\n".join(lines)
