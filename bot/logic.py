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
# Mapa de comunitats autònomes per a cada equip de la 2a Divisió
# (nom intern tal com apareix a Supabase / HYPER_TEAMS)
# ---------------------------------------------------------------------------
TEAM_REGION: dict[str, str] = {
    "Almeria":         "Andalusia",
    "Cadiz":           "Andalusia",
    "Cordoba":         "Andalusia",
    "Granada":         "Andalusia",
    "Eibar":           "País Basc",
    "Real Sociedad B": "País Basc",
    "Sporting":        "Astúries",
    "Oviedo":          "Astúries",
    "Girona":          "Catalunya",
    "Sabadell":        "Catalunya",
    "Andorra":         "Catalunya",  # club domiciliat fora però vinculat a la zona
    "Tenerife":        "Canàries",
    "Las Palmas":      "Canàries",
    "Mallorca":        "Illes Balears",
    "Ceuta":           "Ceuta",
    "Valladolid":      "Castella i Lleó",
    "Burgos":          "Castella i Lleó",
    "Albacete":        "Castella-la Manxa",
    "Castellon":       "Comunitat Valenciana",
    "Eldense":         "Comunitat Valenciana",
    "Leganes":         "Madrid",
    "Celta Fortuna":   "Galícia",
}

# Missatges de troleo per a derbis regionals, indexats per comunitat
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

# Frases de context per a duels directes (prèvia) – placeholders {a}, {b}, {pts_a}, {pts_b}
DUEL_CONTEXT_TAUNTS: list[str] = [
    "Partit de 6 punts clau! {a} ({pos_a}è, {pts_a} pts) i {b} ({pos_b}è, {pts_b} pts) s'hi juguen molt.",
    "{a} defensa la seva posició a casa i {b} busca assaltar-la. Qui parpelleja primer?",
    "Diferència de {diff} pt(s) a la taula. El que guanya s'endú el duel directe de la lligueta.",
    "Directe entre els dos! {a} ({pts_a} pts) i {b} ({pts_b} pts). La tensió és màxima.",
]

# Emojis de resultat per a post-jornada
RESULT_EXACT = "🎯"
RESULT_SIGN  = "🟡"
RESULT_WRONG = "❌"

# Comentaris post-duel (placeholders {winner}, {loser})
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


def _build_team_to_player(participants: list[dict]) -> dict[str, dict]:
    m: dict[str, dict] = {}
    for p in participants:
        team = (p.get("hyper_team_id") or "").strip()
        if team:
            m[team] = p
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
    """
    Detecta duels directes entre companys de la lligueta.

    Retorna llista de dicts:
        match, player_home, player_away
    """
    t2p = _build_team_to_player(participants)
    duels = []
    for match in matches:
        home = (match.get("home_team") or "").strip()
        away = (match.get("away_team") or "").strip()
        ph = t2p.get(home)
        pa = t2p.get(away)
        if ph and pa:
            duels.append({"match": match, "player_home": ph, "player_away": pa})
    return duels


def detect_derbies(matches: list[dict]) -> list[dict]:
    """
    Detecta derbis geogràfics entre equips de la mateixa comunitat.

    Retorna llista de dicts:
        match, region, taunt
    """
    derbies = []
    for match in matches:
        home = (match.get("home_team") or "").strip()
        away = (match.get("away_team") or "").strip()
        rh = TEAM_REGION.get(home)
        ra = TEAM_REGION.get(away)
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
    """
    Genera el missatge de prèvia de jornada per a Telegram (HTML).

    Format:
      🚨 PRÈVIA JORNADA N 🚨
      🔥 <Equip local> ({handle_local}) 🆚 <Equip visitant> ({handle_visitant})
        > Context del duel (punts, posició…)
      ⚽ LA RESTA DE LA TROPA:
        * Equip A vs Equip B ({handle})
      📊 Recordeu que teniu fins a 1 hora abans…
    """
    t2p = _build_team_to_player(participants)
    derby_set = {id(m["match"]) for m in detect_derbies(matches)}

    featured: list[dict] = []   # partits destacats (duel directe o derbi)
    rest: list[dict] = []       # resta de partits

    for match in matches:
        home = (match.get("home_team") or "").strip()
        away = (match.get("away_team") or "").strip()
        ph = t2p.get(home)
        pa = t2p.get(away)
        is_duel = bool(ph and pa)
        is_derby = id(match) in derby_set

        if is_duel or is_derby:
            featured.append({"match": match, "player_home": ph, "player_away": pa,
                              "is_duel": is_duel, "is_derby": is_derby})
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

        # Context del duel directe
        if item["is_duel"] and ph and pa:
            ctx = _duel_context(ph, pa, rankings)
            lines.append(f"  {ctx}")

        # Afegim nota de derbi si escau
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
    """
    Genera el missatge de resultats post-jornada per a Telegram (HTML).

    Format:
      🏁 RESULTATS JORNADA N 🏁
      🔥 <home> ({handle_h}) 🆚 <away> ({handle_a})
        > Resultat real: G-G | @handle: G-G (+X pts emoji) | @handle: G-G (+X pts emoji)
        > Comentari del duel
      ⚽ LA RESTA DE LA TROPA:
        * home vs away ({handle}): Real G-G | Pronòstic: G-G (+X pts emoji)
      📊 ESTAT DE LA LLIGUETA:
        * Top 3: …
        * Cua: …

    Paràmetres
    ----------
    matches         : partits amb home_goals i away_goals (None = no jugat, s'omet).
    participants    : jugadors.
    rankings_before : classificació ABANS de la jornada (per calcular moviments).
    rankings_after  : classificació DESPRÉS de la jornada.
    predictions     : llista de dicts {username, match_key, pred_home, pred_away}.
    """
    t2p = _build_team_to_player(participants)

    # Mapa de prediccions: (username, match_key) → pred
    pred_map: dict[tuple[str, str], dict] = {}
    for pred in predictions:
        key = (pred.get("username", ""), pred.get("match_key", ""))
        pred_map[key] = pred

    # Partits amb resultat
    played = [
        m for m in matches
        if m.get("home_goals") is not None and m.get("away_goals") is not None
    ]

    if not played:
        return (
            f"🏁 <b>RESULTATS JORNADA {round_number}</b> 🏁\n\n"
            "<i>Encara no hi ha resultats disponibles.</i>"
        )

    # Classifiquem partits en destacats i resta (igual que a la prèvia)
    derby_matches = {id(m["match"]) for m in detect_derbies(played)}
    featured: list[dict] = []
    rest: list[dict] = []

    for match in played:
        home = (match.get("home_team") or "").strip()
        away = (match.get("away_team") or "").strip()
        ph = t2p.get(home)
        pa = t2p.get(away)
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
        """Genera les línies de resultat per a un partit."""
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

        # Comentari del duel directe
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
                # Afegim nota sobre punts si hi ha diferència
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

            # Etiqueta del partit
            player = ph or pa
            if ph and pa:
                part_label = f"{home_name} ({_handle(ph)}) vs {away_name} ({_handle(pa)})"
            elif player:
                handle = _handle(player)
                part_label = f"{home_name} vs {away_name} ({handle})"
            else:
                part_label = f"{home_name} vs {away_name}"

            result_str = f"Real <b>{rh}-{ra}</b>"

            # Prediccions dels jugadors involucrats
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

