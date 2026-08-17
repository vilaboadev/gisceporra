-- =============================================================================
-- migrations.sql – Supabase: canvis necessaris per al bot de Telegram
-- =============================================================================
-- Executa aquest fitxer a l'SQL Editor de Supabase (o via CLI).
-- Tots els CREATE/ALTER usen IF NOT EXISTS / IF EXISTS per a idempotència.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Nova columna a `participants`: telegram_handle
--    Permet esmentar els jugadors al missatge de Telegram (@nom).
-- -----------------------------------------------------------------------------
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS telegram_handle TEXT;


-- -----------------------------------------------------------------------------
-- 2. Taula `bot_sent_messages`
--    Safeguard contra duplicats: registra els missatges enviats per jornada i mode.
--    Evita enviar més d'un missatge de prèvia o post-jornada per jornada.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_sent_messages (
  id      SERIAL      PRIMARY KEY,
  jornada INTEGER     NOT NULL,
  mode    TEXT        NOT NULL CHECK (mode IN ('previa', 'postjornada')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jornada, mode)
);


-- -----------------------------------------------------------------------------
-- 3. Vista `hyper_clasificacion`
--    Classificació Hypermotion calculada en temps real des de les prediccions
--    i els resultats. El bot la consulta per obtenir els punts de cada jugador.
--
--    Regles de puntuació:
--      - Resultat exacte (home i away coincideixen)  → 3 pts
--      - Signe correcte (victòria/empat/derrota igual) → 1 pt
--      - Signe incorrecte                             → 0 pts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW hyper_clasificacion AS
SELECT
  p.username,
  p.display_name,
  p.hyper_team_id,
  p.telegram_handle,
  COALESCE(SUM(
    CASE
      WHEN hp.pred_home = hr.home_goals
       AND hp.pred_away = hr.away_goals
      THEN 3
      WHEN
        SIGN(hp.pred_home - hp.pred_away) =
        SIGN(hr.home_goals  - hr.away_goals)
      THEN 1
      ELSE 0
    END
  ), 0) AS puntos
FROM participants p
LEFT JOIN hyper_predictions hp ON hp.username = p.username
LEFT JOIN hyper_results     hr ON hr.match_key  = hp.match_key
                               AND hr.home_goals IS NOT NULL
WHERE p.porra_hyper = TRUE
  AND p.username    <> 'TST'
  AND p.hyper_team_id IS NOT NULL
GROUP BY p.username, p.display_name, p.hyper_team_id, p.telegram_handle
ORDER BY puntos DESC;


-- -----------------------------------------------------------------------------
-- 4. Nova columna `jornada` a `hyper_results`
--    Permet filtrar els partits directament per número de jornada sense dependre
--    del format de match_key. Cal omplir-la en inserir o actualitzar resultats.
-- -----------------------------------------------------------------------------
ALTER TABLE hyper_results
  ADD COLUMN IF NOT EXISTS jornada INTEGER;

-- Migració de dades existents: com que match_key conté l'ID d'ESPN (numèric sense
-- prefix de jornada), no es pot inferir automàticament. Cal fer un UPDATE manual
-- per a cada jornada indicant el rang de dates corresponent. Exemple per a jornada 1:
--
--   UPDATE hyper_results
--     SET jornada = 1
--     WHERE jornada IS NULL
--       AND match_date BETWEEN '2026-08-17' AND '2026-08-18';
--
-- A partir d'ara, la funció syncHyperResults de l'app web ja inclou jornada
-- en cada upsert, de manera que les noves files s'ompliran automàticament.


-- -----------------------------------------------------------------------------
-- 5. Vista `bot_jornada_view`
--    Creuament de partits, participants i prediccions per jornada.
--    El bot la pot usar per generar els missatges sense fer múltiples crides.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW bot_jornada_view AS
SELECT
  hr.match_key,
  hr.jornada,
  hr.home_team,
  hr.away_team,
  hr.match_date,
  hr.home_goals,
  hr.away_goals,
  -- Jugador local
  ph.username      AS home_username,
  ph.display_name  AS home_display_name,
  ph.telegram_handle AS home_handle,
  hp_h.pred_home   AS home_pred_home,
  hp_h.pred_away   AS home_pred_away,
  -- Jugador visitant
  pa.username      AS away_username,
  pa.display_name  AS away_display_name,
  pa.telegram_handle AS away_handle,
  hp_a.pred_home   AS away_pred_home,
  hp_a.pred_away   AS away_pred_away
FROM hyper_results hr
-- Jugador que porta l'equip local
LEFT JOIN participants ph
       ON ph.hyper_team_id = hr.home_team
      AND ph.porra_hyper   = TRUE
      AND ph.username      <> 'TST'
-- Jugador que porta l'equip visitant
LEFT JOIN participants pa
       ON pa.hyper_team_id = hr.away_team
      AND pa.porra_hyper   = TRUE
      AND pa.username      <> 'TST'
-- Predicció del jugador local
LEFT JOIN hyper_predictions hp_h
       ON hp_h.match_key = hr.match_key
      AND hp_h.username  = ph.username
-- Predicció del jugador visitant
LEFT JOIN hyper_predictions hp_a
       ON hp_a.match_key = hr.match_key
      AND hp_a.username  = pa.username;


-- -----------------------------------------------------------------------------
-- 5. Taula `bot_message_templates`
--    Plantilles de text editables des de Supabase per personalitzar els
--    missatges del bot sense haver de modificar el codi.
--
--    Columnes:
--      template_key   – identificador únic (ex: 'derby_andalusia', 'duel_taunt_1')
--      context        – àmbit: 'derby' | 'duel' | 'leader' | 'bottom' | 'close_rival'
--      text           – text de la plantilla (pot contenir {a}, {b}, {pts}…)
--      active         – si FALSE, la plantilla s'ignora
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_message_templates (
  id           SERIAL       PRIMARY KEY,
  template_key TEXT         NOT NULL UNIQUE,
  context      TEXT         NOT NULL,
  text         TEXT         NOT NULL,
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Trigger per actualitzar updated_at automàticament
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_templates_updated_at ON bot_message_templates;
CREATE TRIGGER trg_bot_templates_updated_at
  BEFORE UPDATE ON bot_message_templates
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();


-- Plantilles inicials (derbis i duels)
INSERT INTO bot_message_templates (template_key, context, text) VALUES
  ('derby_andalusia_1', 'derby',
   'Duelo andalús d''urgències. El que perd, la rodada de tapes la paga.'),
  ('derby_andalusia_2', 'derby',
   'Sol, platja i tres punts. Qui porta el millor flamenc al camp? 💃'),
  ('derby_basc_1',      'derby',
   'Derbi basc! Txakoli a punt per celebrar. Aupa!'),
  ('derby_basc_2',      'derby',
   'La ikurriña té un sol color preferit avui vespre.'),
  ('derby_asturias_1',  'derby',
   'Derbi asturià! El carbó encén les passions al Principat.'),
  ('derby_asturias_2',  'derby',
   'Sidra i punts: només n''hi ha prou per a un dels dos. Salut! 🍏'),
  ('derby_cat_1',       'derby',
   'Derbi català! La pedrera contra el camp gran. Forza!'),
  ('derby_canaries_1',  'derby',
   'Derbi canari! L''etern volcà enfront de la duna. 🌋'),
  ('derby_val_1',       'derby',
   'Derbi valencianista! La paella es cuina amb tres punts. 🍊'),
  ('duel_context_1',    'duel',
   'Partit de 6 punts clau! {a} ({pos_a}è, {pts_a} pts) i {b} ({pos_b}è, {pts_b} pts) s''hi juguen molt.'),
  ('duel_context_2',    'duel',
   '{a} defensa la seva posició a casa i {b} busca assaltar-la. Qui parpelleja primer?'),
  ('duel_context_3',    'duel',
   'Diferència de {diff} pt(s) a la taula. El que guanya s''endú el duel directe de la lligueta.'),
  ('post_duel_win_1',   'post_duel',
   'Victòria i ple de {winner} que s''endú el duel directe!'),
  ('post_duel_win_2',   'post_duel',
   '{winner} guanya el mà a mà de la lligueta. {loser} haurà d''esperar revanxa.'),
  ('post_duel_draw_1',  'post_duel',
   'Empat en el duel directe. Cap dels dos avança a la taula.')
ON CONFLICT (template_key) DO NOTHING;
