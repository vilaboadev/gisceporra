## 📋 Arquitectura

SPA vanilla (sense framework) amb Supabase com a backend. Esports data d'ESPN API.

```
index.html          → UI: login, 3 pantalles (Principal, Porra, Mundial)
src/
  app.js            → Lògica principal: auth, navegació, ranking, pronòstics
  flags.js          → Banderes i noms d'equips (FLAG_MAP)
  mundial.js        → Dades ESPN + rendering partits/grups/eliminatòries
  scoring.js        → Càlcul de punts (grups, knockout, bola cristal)
  styles.css        → Mobile-first, variables CSS
tests/
  mundial.test.js   → Tests per format, render, API
  scoring.test.js   → Tests per càlcul de punts
  flags.test.js     → Tests per banderes i noms
```

## 🗄️ Supabase (taules clau)

- `participants` (username, display_name, password_hash)
- `group_predictions` (username, group_name, pred_1st, pred_2nd, pred_3rd) — noms en anglès!
- `group_results` (group_name, actual_1st..actual_4th) — cache, omplert pel codi
- `pronostics` (username, match_key, home_team, away_team, pred_home_goals, pred_away_goals, tie_winner, round) — abans `apuestas`
- `champion_predictions` (username, champion)
- `clasificacion` (username, puntos) — cache, omplert pel codi

## ⚽ Dades ESPN

- Scoreboard: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260611-20260719`
- Standings: `https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026&seasontype=1`
- Els noms d'equip d'ESPN són en **anglès**. Les dades a Supabase també han d'estar en anglès.
- Noms de grup: `"Group A"`, `"Group B"`... es normalitzen a `"A"`, `"B"` al codi.

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

| Fase | Condició | Punts |
|------|----------|-------|
| Grups (tancats) | Equip al top3 | 5 |
| Grups (tancats) | Posició exacta | +5 (total 10) |
| Knockout (finalitzat) | Guanyador | 10-30 segons ronda |
| Knockout (finalitzat) | Resultat exacte | +10-20 extra |
| Campió | Encert | 100 |

## ⏱️ Regles de bloqueig

- Grups: només puntuen si tots els equips tenen `playedGames === 3`
- Knockout: pronòstics editables fins **2 hores abans** del partit
- Placeholder (ex: "Group F 2nd"): partit no editable, mostra "Emparellament per definir"
