# Bot de Telegram – Lligueta de 2a Divisió (Hypermotion)

Bot automatitzat que genera i envia missatges de **prèvia** i **post-jornada** per a la Lligueta Hypermotion al grup de Telegram.

---

## Fitxers

| Fitxer | Descripció |
|---|---|
| `bot.py` | Punt d'entrada: llegeix dades de Supabase i envia el missatge |
| `logic.py` | Funcions pures de detecció (duels, derbis) i format dels missatges |
| `migrations.sql` | SQL a executar a Supabase per habilitar el bot |
| `requirements.txt` | Dependències Python |

---

## Configuració inicial

### 1. Crear el bot a Telegram

1. Parla amb [@BotFather](https://t.me/BotFather) (`/newbot`)
2. Guarda el **token** que et dona
3. Afegeix el bot al grup o canal de Telegram
4. Obté l'**ID del grup** (p.ex. amb `@userinfobot` o consultant l'API de Telegram)

### 2. Afegir secrets a GitHub

Ves a **Settings → Secrets and variables → Actions** i afegeix:

| Secret | Descripció | Ja existeix? |
|---|---|---|
| `SUPABASE_URL` | URL del projecte Supabase | ✅ Compartit amb l'app web |
| `SUPABASE_KEY` | Clau anon/service_role de Supabase | ✅ Compartit amb l'app web |
| `TELEGRAM_BOT_TOKEN` | Token obtingut via @BotFather | 🆕 Cal crear |
| `TELEGRAM_CHAT_ID` | ID del grup o canal de Telegram | 🆕 Cal crear |

### 3. Executar les migracions SQL

Obre l'**SQL Editor de Supabase** i executa `bot/migrations.sql`. Això crea:

- **Columna `telegram_handle`** a `participants` — per als @mentions als missatges
- **Vista `hyper_clasificacion`** — classificació en temps real (3 pts exacte, 1 pt signe)
- **Vista `bot_jornada_view`** — creuament partits + jugadors + prediccions per jornada
- **Taula `bot_message_templates`** — plantilles de text editables des de Supabase (derbis, duels, comentaris post-duel)

### 4. (Opcional) Afegir el handle de Telegram a cada participant

A Supabase → Table Editor → `participants`, omple el camp `telegram_handle` (amb o sense `@`) per a cada jugador. Si no s'omple, el bot usarà el `display_name`.

---

## Queries Supabase que executa el bot

```sql
-- Partits de la jornada
SELECT match_key, home_team, away_team, match_date, home_goals, away_goals
  FROM hyper_results
 WHERE match_key LIKE '{jornada}_%';

-- Participants de la lligueta
SELECT username, display_name, hyper_team_id, nickname, telegram_handle
  FROM participants
 WHERE porra_hyper = true AND username <> 'TST';

-- Classificació (intenta la vista; fallback al càlcul en temps real)
SELECT username, puntos
  FROM hyper_clasificacion
 ORDER BY puntos DESC;

-- Prediccions de la jornada (mode post-jornada)
SELECT username, match_key, pred_home, pred_away
  FROM hyper_predictions
 WHERE match_key LIKE '{jornada}_%';
```

---

## Variables d'entorn

| Variable | Valor per defecte | Descripció |
|---|---|---|
| `SUPABASE_URL` | — | URL del projecte Supabase |
| `SUPABASE_KEY` | — | Clau anon/service_role |
| `TELEGRAM_BOT_TOKEN` | — | Token del bot |
| `TELEGRAM_CHAT_ID` | — | ID del grup/canal |
| `BOT_MODE` | `previa` | `previa` o `postjornada` |
| `ROUND_NUMBER` | *(detecció automàtica)* | Número de jornada (opcional) |

---

## Workflow (`.github/workflows/telegram_bot.yml`)

| Trigger | Mode | Quan |
|---|---|---|
| Cron automàtic | `previa` | Divendres 19:00 UTC (21:00 CEST) |
| Cron automàtic | `postjornada` | Diumenge 22:00 UTC (00:00 CEST dilluns) |
| `workflow_dispatch` manual | `previa` o `postjornada` | Seleccionable + `round_number` opcional |

---

## Exemples de missatge

### Prèvia de jornada

```
🚨 PRÈVIA JORNADA 5 🚨

🔥 Oviedo (@marc) 🆚 Sporting (@pau)
  Diferència de 2 pt(s) a la taula. El que guanya s'endú el duel directe de la lligueta.
  🏟️ Sidra i punts: només n'hi ha prou per a un dels dos. Salut! 🍏

🔥 Granada (@anna) 🆚 Almeria (@jordi)
  Partit de 6 punts clau! @anna (3a, 12 pts) i @jordi (4t, 10 pts) s'hi juguen molt.
  🏟️ Duelo andalús d'urgències. El que perd, la rodada de tapes la paga.

⚽ LA RESTA DE LA TROPA:
  • Valladolid vs Burgos
  • Tenerife vs Las Palmas (@pere)

📊 Recordeu que teniu fins a 1 hora abans del vostre partit respectiu per revisar i guardar les prediccions a la web!
```

### Post-jornada

```
🏁 RESULTATS JORNADA 5 🏁

🔥 Oviedo (@marc) 🆚 Sporting (@pau)
  Resultat real: 2-1
  @marc: 2-1 (+3 pts 🎯)
  @pau: 1-1 (+1 pts 🟡)
  @marc guanya el mà a mà de la lligueta. @pau haurà d'esperar revanxa. @marc salva 3 pt(s); @pau se'n va amb 1.

🔥 Granada (@anna) 🆚 Almeria (@jordi)
  Resultat real: 0-0
  @anna: 1-0 (+0 pts ❌)
  @jordi: 0-0 (+3 pts 🎯)
  Empat en el duel directe. Cap dels dos avança a la taula, segueixen els dos igual.

⚽ LA RESTA DE LA TROPA:
  • Tenerife vs Las Palmas (@pere): Real 1-2 | Pronòstic: 1-1 (+1 pts 🟡)

📊 ESTAT DE LA LLIGUETA:
  • Top 3: 1r @marc (21 pts) | 2r @jordi (18 pts) | 3r @pau (16 pts)
  • Cua: 4a @anna (12 pts) | 5è @pere (9 pts) | 6è @marta (6 pts)
```

---

## Lògica de detecció

### Duels directes
Creua `hyper_team_id` de cada participant amb `home_team`/`away_team` del partit. Si ambdós equips del partit pertanyen a jugadors de la lligueta → duel directe.

### Derbis regionals
Compara la comunitat autònoma dels dos equips (mapa `TEAM_REGION` a `logic.py`). Comunitats detectades: Andalusia, País Basc, Astúries, Catalunya, Canàries, Comunitat Valenciana, Castella i Lleó, Illes Balears.

### Classificació
1. Intenta llegir la vista `hyper_clasificacion` de Supabase
2. Si no existeix o és buida, calcula els punts en temps real:
   - Resultat exacte → **3 pts**
   - Signe correcte (V/E/D) → **1 pt**
   - Signe incorrecte → **0 pts**
