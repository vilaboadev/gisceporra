## 📋 Arquitectura

SPA vanilla (sense framework) amb Supabase com a backend. Esports data d'ESPN API (mundial) i TheSportDB (hypermotion).

## 🚀 Desenvolupament Local

```bash
npm run dev              # Servidor de desenvolupament amb Hot Reload (Vite)
npm run build            # Compilació de producció
```

```
index.html          → UI: login, selector de porra, app mundial, app hypermotion
src/
  app.js            → Lògica principal: auth, navegació, ranking, pronòstics (mundial)
  hyper-app.js      → Lògica Hypermotion: navegació, pantalles, prediccions, perfil
  hyper.js          → Dades TheSportDB + renderitzat pantalles Hypermotion
  hyper-scoring.js  → Càlcul de punts Hypermotion (3/1/0 pts)
  hyper-teams.js    → Mapa d'equips de la Lliga Hypermotion (noms + IDs theSportDB)
  flags.js          → Banderes i noms d'equips (FLAG_MAP) [mundial]
  mundial.js        → Dades ESPN + rendering partits/grups/eliminatòries
  scoring.js        → Càlcul de punts mundial (grups, knockout, bola cristal)
  styles.css        → Mobile-first, variables CSS (mundial + hypermotion)
tests/
  mundial.test.js        → Tests per format, render, API
  scoring.test.js        → Tests per càlcul de punts mundial
  flags.test.js          → Tests per banderes i noms
  hyper-scoring.test.js  → Tests per càlcul de punts Hypermotion
```

## 🔀 Flux de navegació post-login

```
Login → [porra_mundial=true AND porra_hyper=true] → Selector de Porra
                                                         ├── Hypermotion App
                                                         └── Mundial App (readonly)
     → [porra_hyper=true only]                    → Hypermotion App directament
     → [porra_mundial=true only / legacy]          → Mundial App directament
```

## 🗄️ Supabase (taules clau)

### Mundial (existents)
- `participants` (username, display_name, password_hash, **porra_mundial**, **porra_hyper**, **hyper_team_id**, **nickname**, **avatar_url**, tipus)
- `group_predictions` (username, group_name, pred_1st, pred_2nd, pred_3rd) — noms en anglès!
- `group_results` (group_name, actual_1st..actual_4th) — cache, omplert pel codi
- `pronostics` (username, match_key, home_team, away_team, pred_home_goals, pred_away_goals, tie_winner, round) — abans `apuestas`
- `champion_predictions` (username, champion)
- `clasificacion` (username, puntos) — cache, omplert pel codi

### Hypermotion (noves)
- `hyper_predictions` (username, match_key, home_team, away_team, pred_home, pred_away, match_date, match_time) — prediccions dels jugadors
- `hyper_results` (match_key, home_team, away_team, home_goals, away_goals, match_date) — cache resultats, omplert per admin

### Migració SQL necessària
```sql
-- Noves columnes a participants
ALTER TABLE participants ADD COLUMN IF NOT EXISTS porra_mundial BOOLEAN DEFAULT TRUE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS porra_hyper   BOOLEAN DEFAULT FALSE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS hyper_team_id TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS nickname       TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS avatar_url    TEXT;

-- Nova taula per prediccions Hypermotion
CREATE TABLE IF NOT EXISTS hyper_predictions (
  username    TEXT    NOT NULL,
  match_key   TEXT    NOT NULL,
  home_team   TEXT,
  away_team   TEXT,
  pred_home   INTEGER NOT NULL,
  pred_away   INTEGER NOT NULL,
  match_date  TEXT,
  match_time  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (username, match_key)
);

-- Nova taula per resultats Hypermotion (actualitzada per admin)
CREATE TABLE IF NOT EXISTS hyper_results (
  match_key   TEXT    PRIMARY KEY,
  home_team   TEXT,
  away_team   TEXT,
  home_goals  INTEGER,
  away_goals  INTEGER,
  match_date  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## ⚽ Dades ESPN (Mundial)

- Scoreboard: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260611-20260719`
- Standings: `https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026&seasontype=1`
- Els noms d'equip d'ESPN són en **anglès**. Les dades a Supabase també han d'estar en anglès.
- Noms de grup: `"Group A"`, `"Group B"`... es normalitzen a `"A"`, `"B"` al codi.

## 🏟️ Dades ESPN API (Hypermotion)

- Scoreboard: `https://site.api.espn.com/apis/site/v2/sports/soccer/esp.2/scoreboard` (Spanish LALIGA 2)
- Standings: `https://site.web.api.espn.com/apis/v2/sports/soccer/esp.2/standings`
- Equip & Plantilla: `https://site.api.espn.com/apis/site/v2/sports/soccer/esp.2/teams/{teamId}` i `/roster`
- Els IDs d'ESPN s'emmagatzemen a `participants.hyper_team_id` (compatibilitat amb IDs anteriors)
- `hyper-teams.js` té un mapa de noms → IDs d'ESPN de referència per a la Segona Divisió espanyola

## 🧪 Testing (obligatori)

```bash
npm test                 # node --test (tots els tests)
npm run test:coverage    # amb coverage
node --test tests/scoring.test.js  # test específic
```

**TDD workflow:**
1. Escriure test → verificar que falla
2. Implementar → verificar que passa
3. Refactor → verificar que segueix passant

**SOLID:**
- `scoring.js`: funcions pures, sense efectes secundaris, fàcilment testables
- `mundial.js`: render + dades externes separades
- `flags.js`: responsabilitat única (banderes i noms)

## 🔤 Convencions

- Textos UI en **català**
- **Mai** usar "aposta/apostes" → sempre "pronòstic/pronòstics"
- Noms d'equip a la BD en **anglès** (ESPN)
- `classificar` ≠ `classificar-se` → usar "tancat" per grups finalitzats
- Usuari test: `username = 'TST'`, no ha d'aparèixer al ranking

## 📐 Puntuació

### Mundial
| Fase | Condició | Punts |
|------|----------|-------|
| Grups (tancats) | Equip al top3 | 5 |
| Grups (tancats) | Posició exacta | +5 (total 10) |
| Knockout (finalitzat) | Guanyador | 10-30 segons ronda |
| Knockout (finalitzat) | Resultat exacte | +10-20 extra |
| Campió | Encert | 100 |

### Hypermotion
| Condició | Punts |
|----------|-------|
| Resultat exacte (ex: predia 2-1, queda 2-1) | 3 |
| Signe correcte (ex: predia 0-0, queda 1-1) | 1 |
| Signe incorrecte | 0 |

## ⏱️ Regles de bloqueig

- Grups: només puntuen si tots els equips tenen `playedGames === 3`
- Knockout: pronòstics editables fins **2 hores abans** del partit
- Placeholder (ex: "Group F 2nd"): partit no editable, mostra "Emparellament per definir"
- Hypermotion: pronòstics editables fins **1 hora abans** del partit
