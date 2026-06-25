-- =============================================================
-- Gisceporra Mundial 2026 - Supabase Setup
-- Executa al SQL Editor de Supabase
-- =============================================================

-- 1. SCHEMA


-- Participants (custom auth, sense Supabase Auth)
CREATE TABLE IF NOT EXISTS public.participants (
  username     TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Apostes fase de grups (ja recollides del formulari Google)
CREATE TABLE IF NOT EXISTS public.group_predictions (
  id         SERIAL PRIMARY KEY,
  username   TEXT REFERENCES public.participants(username) ON DELETE CASCADE,
  group_name TEXT NOT NULL,  -- 'A'..'L'
  pred_1st   TEXT,
  pred_2nd   TEXT,
  pred_3rd   TEXT,
  UNIQUE(username, group_name)
);

-- Prediccions campió (Bola de Cristal - fase grups)
CREATE TABLE IF NOT EXISTS public.champion_predictions (
  username TEXT PRIMARY KEY REFERENCES public.participants(username) ON DELETE CASCADE,
  champion TEXT
);

-- Resultats oficials de grups (l'admin omple aqui quan acabi cada grup)
CREATE TABLE IF NOT EXISTS public.group_results (
  group_name  TEXT PRIMARY KEY,  -- 'A'..'L'
  actual_1st  TEXT,
  actual_2nd  TEXT,
  actual_3rd  TEXT,
  actual_4th  TEXT,              -- 4t lloc (per mostrar l'ordre complet)
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Apostes fase eliminatoria (un cop es coneixen emparellaments)
-- match_key = ESPN event ID (string)
CREATE TABLE IF NOT EXISTS public.apuestas (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username         TEXT REFERENCES public.participants(username) ON DELETE CASCADE,
  match_key        TEXT NOT NULL,   -- ESPN event ID
  home_team        TEXT NOT NULL,
  away_team        TEXT NOT NULL,
  pred_home_goals  INT NOT NULL,
  pred_away_goals  INT NOT NULL,
  tie_winner       TEXT,            -- equip que passa si empat (penals)
  round            TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(username, match_key)
);

-- Classificacio calculada (cache, recalculada per trigger o per l'app)
CREATE TABLE IF NOT EXISTS public.clasificacion (
  username     TEXT PRIMARY KEY REFERENCES public.participants(username) ON DELETE CASCADE,
  puntos       INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Desactiva RLS per a app interna d'equip (tothom llegeix tot)
ALTER TABLE public.participants       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_predictions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.champion_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_results      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.apuestas           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clasificacion      DISABLE ROW LEVEL SECURITY;

-- 2. PARTICIPANTS (contrasenya inicial = username)

INSERT INTO public.participants (username, display_name, password_hash) VALUES ('AOG', 'Aleix Oliva', 'b50b740f2fe89188095299dba1fcb25b4d1192f47fcb15f086165213df165f23') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('ABG', 'Adrián Baena', '002eff8d3fa2956020e921086420bdb69b0bf5065e850c7d25bc532ab8395ef2') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('JPP', 'Joan Pérez', '7fa2d2a28e049944eaa9f5955951c65d886ab3f3eee0865609bf7b9ea5cf2fe6') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('AFB', 'Agustí Fita', 'bb56c5340936c201d51a6e38d58339241bb10cf328980751b2102c1660eb67e8') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('SGL', 'Sebastian Jesus Gutierrez', '1b8955cf48d912938cb9c85e0659a889ef0bf23453dde7f17f10c52a8e2fc718') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('LBA', 'Luis Carlos Bautista', '8b729af80f8d6a930010b7e30f27920c31cc6e8da83dd73ef498fcad885cdaa0') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('NVI', 'Nil Villarroya', '14b5dca24f5e4062a78c2adca93ac5767f17dd11f7fd55b78dad9f5a0348dee9') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('IPB', 'Iker Paz', 'e86d5ca15479aab650baf85eafb9ad484b19ed7d2a9e6ce7d52b8d517e1eb4d6') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('MVF', 'Marcos Vilaboa', '0631b667b82f6f7728c27a642da6c02399c8a3cca0ab5246f60fdcf97965a62a') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('RCA', 'Roni F C', 'd93580ed3a1f04357b509f92f1ba48b048d161f09c4c70343c74f4f18af17647') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.participants (username, display_name, password_hash) VALUES ('test', 'Test User', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08') ON CONFLICT (username) DO NOTHING;

-- 3. GRUP PREDICTIONS

INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'A', 'Corea del Sud', 'Mèxic', 'Txèquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'B', 'Suïssa', 'Canadà', 'Qatar') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'C', 'Brasil', 'Marroc', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'D', 'Estats Units', 'Australia', 'Turquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'E', 'Alemanya', 'Ecuador', 'Curaçao') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'F', 'Països Baixos', 'Japó', 'Suècia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'G', 'Bèlgica', 'Egipte', 'Iran') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'H', 'Urugay', 'Espanya', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'I', 'Noruega', 'França', 'Iraq') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'J', 'Argentina', 'Austria', 'Algèria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'K', 'Portugal', 'Colòmbia', 'Uzbekistan') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AOG', 'L', 'Anglaterra', 'Croàcia', 'Panamà') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'A', 'Mèxic', 'Corea del Sud', 'Txèquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'B', 'Suïssa', 'Canadà', 'Qatar') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'C', 'Brasil', 'Marroc', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'D', 'Turquia', 'Estats Units', 'Australia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'E', 'Alemanya', 'Ecuador', 'Curaçao') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'F', 'Països Baixos', 'Japó', 'Tunísia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'G', 'Bèlgica', 'Egipte', 'Iran') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'H', 'Espanya', 'Urugay', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'I', 'França', 'Noruega', 'Senegal') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'J', 'Argentina', 'Austria', 'Algèria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'K', 'Portugal', 'Colòmbia', 'Uzbekistan') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('ABG', 'L', 'Anglaterra', 'Croàcia', 'Ghana') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'A', 'Corea del Sud', 'Mèxic', 'Txèquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'B', 'Suïssa', 'Canadà', 'Bòsnia i Herzegovina') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'C', 'Marroc', 'Brasil', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'D', 'Estats Units', 'Australia', 'Turquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'E', 'Alemanya', 'Costa d''Ivori', 'Ecuador') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'F', 'Països Baixos', 'Suècia', 'Japó') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'G', 'Bèlgica', 'Egipte', 'Iran') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'H', 'Espanya', 'Urugay', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'I', 'França', 'Senegal', 'Noruega') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'J', 'Argentina', 'Austria', 'Algèria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'K', 'Portugal', 'Colòmbia', 'Uzbekistan') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('JPP', 'L', 'Anglaterra', 'Croàcia', 'Ghana') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'A', 'Mèxic', 'Txèquia', 'Corea del Sud') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'B', 'Suïssa', 'Bòsnia i Herzegovina', 'Qatar') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'C', 'Marroc', 'Brasil', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'D', 'Estats Units', 'Paraguai', 'Turquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'E', 'Alemanya', 'Ecuador', 'Costa d''Ivori') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'F', 'Països Baixos', 'Suècia', 'Tunísia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'G', 'Bèlgica', 'Egipte', 'Nova Zelanda') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'H', 'Urugay', 'Espanya', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'I', 'França', 'Senegal', 'Noruega') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'J', 'Argentina', 'Algèria', 'Austria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'K', 'Colòmbia', 'Portugal', 'Uzbekistan') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('AFB', 'L', 'Croàcia', 'Anglaterra', 'Panamà') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'A', 'Corea del Sud', 'Mèxic', 'Txèquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'B', 'Suïssa', 'Canadà', 'Qatar') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'C', 'Brasil', 'Marroc', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'D', 'Estats Units', 'Turquia', 'Australia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'E', 'Alemanya', 'Costa d''Ivori', 'Ecuador') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'F', 'Japó', 'Països Baixos', 'Suècia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'G', 'Bèlgica', 'Egipte', 'Iran') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'H', 'Urugay', 'Espanya', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'I', 'França', 'Senegal', 'Noruega') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'J', 'Argentina', 'Algèria', 'Austria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'K', 'Colòmbia', 'Portugal', 'RD Congo') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('SGL', 'L', 'Anglaterra', 'Croàcia', 'Ghana') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'A', 'Mèxic', 'Corea del Sud', 'Txèquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'B', 'Canadà', 'Suïssa', 'Qatar') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'C', 'Brasil', 'Marroc', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'D', 'Australia', 'Estats Units', 'Turquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'E', 'Alemanya', 'Costa d''Ivori', 'Ecuador') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'F', 'Japó', 'Suècia', 'Països Baixos') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'G', 'Bèlgica', 'Iran', 'Nova Zelanda') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'H', 'Urugay', 'Espanya', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'I', 'França', 'Noruega', 'Senegal') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'J', 'Argentina', 'Austria', 'Algèria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'K', 'Portugal', 'Colòmbia', 'RD Congo') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('LBA', 'L', 'Croàcia', 'Anglaterra', 'Ghana') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'A', 'Mèxic', 'Corea del Sud', 'Sud-àfrica') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'B', 'Canadà', 'Suïssa', 'Bòsnia i Herzegovina') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'C', 'Marroc', 'Brasil', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'D', 'Estats Units', 'Australia', 'Turquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'E', 'Alemanya', 'Ecuador', 'Costa d''Ivori') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'F', 'Japó', 'Suècia', 'Països Baixos') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'G', 'Bèlgica', 'Iran', 'Egipte') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'H', 'Espanya', 'Urugay', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'I', 'França', 'Noruega', 'Senegal') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'J', 'Argentina', 'Austria', 'Jordania') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'K', 'Portugal', 'Colòmbia', 'Uzbekistan') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('NVI', 'L', 'Anglaterra', 'Croàcia', 'Ghana') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'A', 'Mèxic', 'Corea del Sud', 'Txèquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'B', 'Suïssa', 'Canadà', 'Qatar') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'C', 'Marroc', 'Brasil', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'D', 'Estats Units', 'Turquia', 'Australia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'E', 'Alemanya', 'Costa d''Ivori', 'Ecuador') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'F', 'Suècia', 'Japó', 'Països Baixos') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'G', 'Bèlgica', 'Egipte', 'Iran') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'H', 'Espanya', 'Urugay', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'I', 'França', 'Noruega', 'Senegal') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'J', 'Argentina', 'Austria', 'Algèria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'K', 'Portugal', 'Colòmbia', 'RD Congo') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('IPB', 'L', 'Anglaterra', 'Croàcia', 'Ghana') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'A', 'Mèxic', 'Corea del Sud', 'Txèquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'B', 'Canadà', 'Suïssa', 'Bòsnia i Herzegovina') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'C', 'Marroc', 'Brasil', 'Escòcia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'D', 'Estats Units', 'Australia', 'Turquia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'E', 'Alemanya', 'Ecuador', 'Costa d''Ivori') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'F', 'Països Baixos', 'Suècia', 'Japó') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'G', 'Bèlgica', 'Egipte', 'Nova Zelanda') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'H', 'Espanya', 'Urugay', 'Aràbia Saudita') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'I', 'França', 'Noruega', 'Senegal') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'J', 'Argentina', 'Austria', 'Algèria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'K', 'Portugal', 'Colòmbia', 'RD Congo') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('MVF', 'L', 'Anglaterra', 'Croàcia', 'Panamà') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'A', 'Mèxic', 'Corea del Sud', 'Sud-àfrica') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'B', 'Suïssa', 'Canadà', 'Bòsnia i Herzegovina') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'C', 'Marroc', 'Brasil', 'Haití') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'D', 'Turquia', 'Estats Units', 'Australia') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'E', 'Alemanya', 'Ecuador', 'Curaçao') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'F', 'Japó', 'Suècia', 'Països Baixos') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'G', 'Bèlgica', 'Nova Zelanda', 'Egipte') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'H', 'Espanya', 'Urugay', 'Cap Verd') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'I', 'França', 'Noruega', 'Senegal') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'J', 'Argentina', 'Jordania', 'Algèria') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'K', 'Colòmbia', 'Portugal', 'RD Congo') ON CONFLICT (username, group_name) DO NOTHING;
INSERT INTO public.group_predictions (username, group_name, pred_1st, pred_2nd, pred_3rd) VALUES ('RCA', 'L', 'Anglaterra', 'Croàcia', 'Panamà') ON CONFLICT (username, group_name) DO NOTHING;

-- 4. CHAMPION PREDICTIONS (Bola de Cristal)

INSERT INTO public.champion_predictions (username, champion) VALUES ('AOG', 'Argentina') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('ABG', 'Espanya') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('JPP', 'Espanya') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('AFB', 'Anglaterra') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('SGL', 'Argentina') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('LBA', 'Espanya') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('NVI', 'Espanya') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('IPB', 'Espanya') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('MVF', 'Espanya') ON CONFLICT (username) DO NOTHING;
INSERT INTO public.champion_predictions (username, champion) VALUES ('RCA', 'Brasil') ON CONFLICT (username) DO NOTHING;

-- 5. INICIAL CLASIFICACION (0 punts - es recalcula)

INSERT INTO public.clasificacion (username, puntos) VALUES ('AOG', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('ABG', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('JPP', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('AFB', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('SGL', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('LBA', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('NVI', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('IPB', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('MVF', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('RCA', 0) ON CONFLICT (username) DO NOTHING;
INSERT INTO public.clasificacion (username, puntos) VALUES ('test', 0) ON CONFLICT (username) DO NOTHING;

-- 6. RESUM DE CONTRASENYES INICIALS
-- Cada participant entra amb: usuari = inicials, contrasenya = inicials
-- Exemple: AOG entra amb username "AOG" i password "AOG"
-- L'usuari de prova: test / test
--
-- Per canviar contrasenya d'un participant (executa com a admin):
-- UPDATE public.participants SET password_hash = encode(digest('nova_contrasenya','sha256'),'hex') WHERE username = 'XXX';
--
-- IMPORTANT: el camp password_hash usa SHA-256 en hexadecimal

