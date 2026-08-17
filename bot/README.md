# Bot de Telegram – Lligueta de 2a Divisió (Hypermotion)

Bot automatitzat que genera i envia missatges de **prèvia** i **post-jornada** per a la Lligueta Hypermotion al grup de Telegram.

---

## Fitxers

| Fitxer | Descripció |
|---|---|
| `bot.py` | Punt d'entrada: detecció intel·ligent de jornada, safeguard de duplicats, enviament |
| `logic.py` | Funcions pures de detecció (duels, derbis) i format dels missatges |
| `migrations.sql` | SQL complet a executar a Supabase (preparació + taules + vistes) |
| `requirements.txt` | Dependències Python |

---

## Lògica del workflow (robust a jornades intersetmanals)

El workflow s'executa **cada dia a les 19:00 UTC**. En mode `auto` (per defecte):

1. Consulta totes les jornades i dates dels partits a `hyper_results`
2. **Missatge prèvia**: s'envia si la jornada pendent té el primer partit avui o demà
3. **Missatge post-jornada**: s'envia si tots els partits d'una jornada ja tenen resultat i l'últim va acabar ahir o abans
4. **Safeguard de duplicats**: comprova la taula `bot_sent_messages`; si ja s'ha enviat per a `(jornada, mode)`, no envia res

Gràcies a la detecció per dates, funciona correctament per a jornades entre setmana, caps de setmana llargs i qualsevol calendari irregular.

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

### 3. Executar les migracions SQL a Supabase

Obre l'**SQL Editor de Supabase** i executa `bot/migrations.sql`. El fitxer és idempotent (usa `IF NOT EXISTS`).

### 4. (Opcional) Afegir el handle de Telegram a cada participant

A Supabase → Table Editor → `participants`, omple el camp `telegram_handle` (amb o sense `@`) per a cada jugador. Si no s'omple, el bot usarà el `display_name`.

---

## SQL de preparació (resum del que fa `migrations.sql`)

Executa `bot/migrations.sql` una única vegada a l'**SQL Editor de Supabase**. Aquí tens el resum de cada bloc:

### 1. Columna `telegram_handle` a `participants`

```sql
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS telegram_handle TEXT;
```

### 2. Taula `bot_sent_messages` (safeguard de duplicats)

```sql
CREATE TABLE IF NOT EXISTS bot_sent_messages (
  id      SERIAL      PRIMARY KEY,
  jornada INTEGER     NOT NULL,
  mode    TEXT        NOT NULL CHECK (mode IN ('previa', 'postjornada')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jornada, mode)
);
```

### 3. Vista `hyper_clasificacion` (classificació en temps real)

```sql
CREATE OR REPLACE VIEW hyper_clasificacion AS
SELECT
  p.username,
  p.display_name,
  p.hyper_team_id,
  p.telegram_handle,
  COALESCE(SUM(
    CASE
      WHEN hp.pred_home = hr.home_goals AND hp.pred_away = hr.away_goals THEN 3
      WHEN SIGN(hp.pred_home - hp.pred_away) = SIGN(hr.home_goals - hr.away_goals) THEN 1
      ELSE 0
    END
  ), 0) AS puntos
FROM participants p
LEFT JOIN hyper_predictions hp ON hp.username = p.username
LEFT JOIN hyper_results     hr ON hr.match_key = hp.match_key
                               AND hr.home_goals IS NOT NULL
WHERE p.porra_hyper = TRUE
  AND p.username    <> 'TST'
  AND p.hyper_team_id IS NOT NULL
GROUP BY p.username, p.display_name, p.hyper_team_id, p.telegram_handle
ORDER BY puntos DESC;
```

### 4. Vista `bot_jornada_view` (creuament partits + jugadors + prediccions)

```sql
CREATE OR REPLACE VIEW bot_jornada_view AS
SELECT
  hr.match_key,
  CAST(SPLIT_PART(hr.match_key, '_', 1) AS INTEGER) AS jornada,
  hr.home_team,
  hr.away_team,
  hr.match_date,
  hr.home_goals,
  hr.away_goals,
  ph.username        AS home_username,
  ph.display_name    AS home_display_name,
  ph.telegram_handle AS home_handle,
  hp_h.pred_home     AS home_pred_home,
  hp_h.pred_away     AS home_pred_away,
  pa.username        AS away_username,
  pa.display_name    AS away_display_name,
  pa.telegram_handle AS away_handle,
  hp_a.pred_home     AS away_pred_home,
  hp_a.pred_away     AS away_pred_away
FROM hyper_results hr
LEFT JOIN participants ph
       ON ph.hyper_team_id = hr.home_team AND ph.porra_hyper = TRUE AND ph.username <> 'TST'
LEFT JOIN participants pa
       ON pa.hyper_team_id = hr.away_team AND pa.porra_hyper = TRUE AND pa.username <> 'TST'
LEFT JOIN hyper_predictions hp_h
       ON hp_h.match_key = hr.match_key AND hp_h.username = ph.username
LEFT JOIN hyper_predictions hp_a
       ON hp_a.match_key = hr.match_key AND hp_a.username = pa.username;
```

### 5. Taula `bot_message_templates` (plantilles editables des de Supabase)

```sql
CREATE TABLE IF NOT EXISTS bot_message_templates (
  id           SERIAL       PRIMARY KEY,
  template_key TEXT         NOT NULL UNIQUE,
  context      TEXT         NOT NULL,  -- 'derby' | 'duel' | 'post_duel'
  text         TEXT         NOT NULL,
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

Els inserts inicials (frases de derbis, duels i post-duel) estan inclosos a `migrations.sql`.

---

## Queries Supabase que executa el bot en runtime

```sql
-- Detecció automàtica de jornada (mode auto)
SELECT match_key, match_date, home_goals, away_goals
  FROM hyper_results ORDER BY match_key;

-- Partits de la jornada concreta
SELECT match_key, home_team, away_team, match_date, home_goals, away_goals
  FROM hyper_results WHERE match_key LIKE '{jornada}_%';

-- Participants de la lligueta
SELECT username, display_name, hyper_team_id, nickname, telegram_handle
  FROM participants WHERE porra_hyper = true AND username <> 'TST';

-- Classificació (intenta la vista; fallback al càlcul en temps real)
SELECT username, puntos FROM hyper_clasificacion ORDER BY puntos DESC;

-- Prediccions de la jornada (mode post-jornada)
SELECT username, match_key, pred_home, pred_away
  FROM hyper_predictions WHERE match_key LIKE '{jornada}_%';

-- Safeguard: comprova si ja s'ha enviat
SELECT id FROM bot_sent_messages WHERE jornada = {n} AND mode = '{mode}';

-- Safeguard: registra l'enviament (ON CONFLICT evita duplicats de raça)
INSERT INTO bot_sent_messages (jornada, mode) VALUES ({n}, '{mode}') ON CONFLICT DO NOTHING;
```

---

## Variables d'entorn

| Variable | Valor per defecte | Descripció |
|---|---|---|
| `SUPABASE_URL` | — | URL del projecte Supabase |
| `SUPABASE_KEY` | — | Clau anon/service_role |
| `TELEGRAM_BOT_TOKEN` | — | Token del bot |
| `TELEGRAM_CHAT_ID` | — | ID del grup/canal |
| `BOT_MODE` | `auto` | `auto`, `previa` o `postjornada` |
| `ROUND_NUMBER` | *(detecció automàtica)* | Número de jornada (opcional, sobreescriu la detecció) |
| `FORCE_SEND` | `false` | `true` per saltar el safeguard de duplicats |

---

## Workflow (`.github/workflows/telegram_bot.yml`)

| Trigger | Mode | Quan |
|---|---|---|
| Cron automàtic diari | `auto` | Cada dia a les 19:00 UTC (21:00 CEST) |
| `workflow_dispatch` manual | `auto` / `previa` / `postjornada` | Seleccionable |

El `workflow_dispatch` admet:
- `mode`: `auto`, `previa` o `postjornada`
- `round_number`: número de jornada (buit = detecció automàtica)
- `force`: `true` per saltar el safeguard de duplicats (útil per testing o recuperació)

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
  @marc guanya el mà a mà de la lligueta. @pau haurà d'esperar revanxa.

🔥 Granada (@anna) 🆚 Almeria (@jordi)
  Resultat real: 0-0
  @anna: 1-0 (+0 pts ❌)
  @jordi: 0-0 (+3 pts 🎯)
  Empat en el duel directe. Cap dels dos avança a la taula.

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
