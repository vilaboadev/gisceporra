"""
logic.py – Intel·ligència del bot de la Lligueta de 2a Divisió.

Funcions pures (sense efectes secundaris) per detectar:
  - Duels directes entre companys de la lligueta
  - Derbis geogràfics
  - Context de classificació (líder vs cuer, rivals directes…)
"""

from __future__ import annotations

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
        "⚠️ DERBI ANDALÚS! Qui porta el millor flamenc al camp? 💃",
        "🌞 Sol, platja i tres punts. El que perd, la rodada de tapes la paga.",
    ],
    "País Basc": [
        "⚠️ DERBI BASC! Txakoli a punt per celebrar. Aupa!",
        "🌧️ Meritxell o Ainhoa, avui la ikurriña té un sol color preferit.",
    ],
    "Astúries": [
        "⚠️ DERBI ASTURIÀ! El carbó encén les passions al Principat.",
        "🍏 Sidra i punts: només n'hi ha prou per a un dels dos. Salut!",
    ],
    "Catalunya": [
        "⚠️ DERBI CATALÀ! La pedrera contra el camp gran. Forza!",
        "🌹 La Rosa de Sant Jordi va per als tres punts, no per dividir-los.",
    ],
    "Canàries": [
        "⚠️ DERBI CANARI! Tenerife vs Gran Canaria: l'etern volcà enfront de la duna.",
        "🌋 Qui guanya governa l'arxipèlag futbolístic per una setmana més.",
    ],
    "Castella i Lleó": [
        "⚠️ DERBI CASTELLÀ! Mesetes àrides, però el futbol és molt calent.",
    ],
    "Comunitat Valenciana": [
        "⚠️ DERBI VALENCIANISTA! La paella es cuina amb tres punts.",
        "🍊 Taronges i rivalitat: la combinació perfecta del Llevant.",
    ],
}

# Frases de troleo per a duels directes entre companys (placeholders {a} i {b})
DIRECT_DUEL_TAUNTS: list[str] = [
    "⚔️ {a} vs {b}! El partit de la lligueta dins el partit de la jornada. Qui dorm avui tranquil?",
    "🎯 {a}, el teu equip juga contra el de {b}. I tots dos ho sabeu. Pressió màxima! 😅",
    "💥 PICA! {a} i {b} s'enfronten. Qui guanya avui convida a les birres? 🍺",
    "🔥 {a} contra {b}: el que perd haurà de suportar les burles fins a la propera jornada.",
    "🤜🤛 {a} i {b} cara a cara. El futbol és cruel, però la lligueta encara més.",
]

# Frases per a partits del líder
LEADER_TAUNTS: list[str] = [
    "👑 El líder {leader} ({pts} pts) entra en escena. El seu equip no pot fallar.",
    "🏆 {leader} manda a la taula amb {pts} pts. Avui vol ampliar diferències.",
]

# Frases per a partits del cuer
BOTTOM_TAUNTS: list[str] = [
    "😬 {bottom} porta la lanterna vermella ({pts} pts). Una altra derrota i serà molt fosc.",
    "⚠️ {bottom} és el darrer de la taula amb {pts} pts. Avui és clau per sobreviure.",
]

# Frases per a rivals directes separats per pocs punts
CLOSE_RIVAL_TAUNTS: list[str] = [
    "📊 {a} ({pts_a} pts) i {b} ({pts_b} pts) estan separats per {diff} punt(s). Directe vital!",
    "🔍 {a} i {b} separats per tan sols {diff} punt(s). Qui guanya avança a la taula!",
]

import random


def detect_direct_duels(
    matches: list[dict],
    participants: list[dict],
) -> list[dict]:
    """
    Detecta duels directes entre companys de la lligueta.

    Paràmetres
    ----------
    matches : llista de dicts amb claus ``home_team`` i ``away_team``
              (noms interns, ex: 'Granada', 'Oviedo').
    participants : llista de dicts amb claus ``display_name`` (o ``username``)
                   i ``hyper_team_id`` (nom intern de l'equip).

    Retorna
    -------
    Llista de dicts:
        {
            "match": <match dict>,
            "player_home": <participant dict>,
            "player_away": <participant dict>,
            "taunt": <str>,
        }
    """
    team_to_player: dict[str, dict] = {}
    for p in participants:
        team = (p.get("hyper_team_id") or "").strip()
        if team:
            team_to_player[team] = p

    duels = []
    for match in matches:
        home = (match.get("home_team") or "").strip()
        away = (match.get("away_team") or "").strip()
        ph = team_to_player.get(home)
        pa = team_to_player.get(away)
        if ph and pa:
            name_a = ph.get("display_name") or ph.get("username", "?")
            name_b = pa.get("display_name") or pa.get("username", "?")
            taunt = random.choice(DIRECT_DUEL_TAUNTS).format(a=name_a, b=name_b)
            duels.append({
                "match": match,
                "player_home": ph,
                "player_away": pa,
                "taunt": taunt,
            })
    return duels


def detect_derbies(matches: list[dict]) -> list[dict]:
    """
    Detecta derbis geogràfics entre equips de la mateixa comunitat autònoma.

    Retorna
    -------
    Llista de dicts:
        {
            "match": <match dict>,
            "region": <str>,
            "taunt": <str>,
        }
    """
    derbies = []
    for match in matches:
        home = (match.get("home_team") or "").strip()
        away = (match.get("away_team") or "").strip()
        region_h = TEAM_REGION.get(home)
        region_a = TEAM_REGION.get(away)
        if region_h and region_h == region_a:
            taunts = DERBY_TAUNTS.get(region_h, [f"⚠️ DERBI de {region_h}!"])
            derbies.append({
                "match": match,
                "region": region_h,
                "taunt": random.choice(taunts),
            })
    return derbies


def classify_context(
    match: dict,
    rankings: list[dict],
) -> str | None:
    """
    Genera un missatge de context de classificació per a un partit concret.

    Paràmetres
    ----------
    match : dict amb ``home_team`` i ``away_team``.
    rankings : llista de dicts ordenada per punts (descendent) amb claus
               ``display_name`` / ``username``, ``hyper_team_id``, ``puntos``.

    Retorna
    -------
    String amb el missatge o None si no hi ha context rellevant.
    """
    if not rankings:
        return None

    # Indexem per equip
    team_rank: dict[str, dict] = {}
    for idx, r in enumerate(rankings):
        team = (r.get("hyper_team_id") or "").strip()
        if team:
            team_rank[team] = {**r, "_pos": idx + 1}

    home = (match.get("home_team") or "").strip()
    away = (match.get("away_team") or "").strip()

    rh = team_rank.get(home)
    ra = team_rank.get(away)
    if not rh or not ra:
        return None

    leader = rankings[0]
    bottom = rankings[-1]
    leader_team = (leader.get("hyper_team_id") or "").strip()
    bottom_team = (bottom.get("hyper_team_id") or "").strip()

    msgs = []

    # Líder involucrat
    if home == leader_team or away == leader_team:
        name = leader.get("display_name") or leader.get("username", "?")
        pts = leader.get("puntos", 0)
        msgs.append(random.choice(LEADER_TAUNTS).format(leader=name, pts=pts))

    # Cuer involucrat
    if home == bottom_team or away == bottom_team:
        name = bottom.get("display_name") or bottom.get("username", "?")
        pts = bottom.get("puntos", 0)
        msgs.append(random.choice(BOTTOM_TAUNTS).format(bottom=name, pts=pts))

    # Rivals directes (≤3 punts de diferència, exclou líder i cuer)
    diff = abs((rh.get("puntos") or 0) - (ra.get("puntos") or 0))
    if diff <= 3 and home != leader_team and away != leader_team \
            and home != bottom_team and away != bottom_team:
        name_h = rh.get("display_name") or rh.get("username", "?")
        name_a = ra.get("display_name") or ra.get("username", "?")
        msgs.append(
            random.choice(CLOSE_RIVAL_TAUNTS).format(
                a=name_h,
                pts_a=rh.get("puntos", 0),
                b=name_a,
                pts_b=ra.get("puntos", 0),
                diff=diff,
            )
        )

    return "\n".join(msgs) if msgs else None


def _esc(text: str) -> str:
    """Escapa caràcters especials d'HTML per a noms dinàmics."""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    )


def format_prejornada_message(
    round_number: int,
    matches: list[dict],
    participants: list[dict],
    rankings: list[dict],
) -> str:
    """
    Genera el missatge complet de pre-jornada per a Telegram (HTML).

    Paràmetres
    ----------
    round_number : número de jornada.
    matches      : partits de la jornada (dicts amb home_team, away_team, match_date, match_time).
    participants : jugadors de la lligueta (dicts amb display_name, hyper_team_id).
    rankings     : classificació actual (ordenada per puntos desc).

    Retorna
    -------
    Missatge formatat en HTML (compatible amb Telegram parse_mode=HTML).
    """
    lines: list[str] = []
    lines.append(f"⚽ <b>JORNADA {round_number} – PRÈVIA</b> ⚽")
    lines.append("")

    # --- Partits de la jornada ---
    lines.append("📅 <b>Partits de la jornada:</b>")
    for m in matches:
        home = _esc(m.get("home_team", "?"))
        away = _esc(m.get("away_team", "?"))
        date = _esc(m.get("match_date", ""))
        time_ = _esc(m.get("match_time", ""))
        when = f"{date} {time_}".strip()
        lines.append(f"  • {home} vs {away}" + (f"  <i>{when}</i>" if when else ""))
    lines.append("")

    # --- Piques directes ---
    duels = detect_direct_duels(matches, participants)
    if duels:
        lines.append("🔥 <b>PIQUES DIRECTES:</b>")
        for d in duels:
            lines.append(_esc(d["taunt"]))
        lines.append("")

    # --- Derbis geogràfics ---
    derbies = detect_derbies(matches)
    if derbies:
        lines.append("🏟️ <b>DERBIS DE LA JORNADA:</b>")
        for db in derbies:
            lines.append(_esc(db["taunt"]))
        lines.append("")

    # --- Context classificació per a cada partit ---
    ctx_lines: list[str] = []
    for m in matches:
        ctx = classify_context(m, rankings)
        if ctx:
            ctx_lines.append(_esc(ctx))
    if ctx_lines:
        lines.append("📊 <b>CONTEXT CLASSIFICACIÓ:</b>")
        lines.extend(ctx_lines)
        lines.append("")

    # --- Classificació actual ---
    if rankings:
        lines.append("🏆 <b>Classificació actual de la lligueta:</b>")
        for idx, r in enumerate(rankings, 1):
            name = _esc(r.get("display_name") or r.get("username", "?"))
            team = _esc(r.get("hyper_team_id", "?"))
            pts = r.get("puntos", 0)
            lines.append(f"  {idx}. {name} ({team}) – {pts} pts")
        lines.append("")

    lines.append("<i>Bona sort a tothom! 🍀</i>")
    return "\n".join(lines)
