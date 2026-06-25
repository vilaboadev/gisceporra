-- =============================================================
-- Gisceporra Mundial 2026 - Normalització noms equips a anglès
-- Executa al SQL Editor de Supabase
-- =============================================================
-- Les dades d'ESPN arriben en anglès (ex: "Brazil", "Spain").
-- Cal normalitzar les dades locals a anglès per fer lookup directe.
-- =============================================================

-- Helper: UPDATE group_predictions (3 columnes)
UPDATE public.group_predictions SET pred_1st = 'Spain' WHERE pred_1st = 'Espanya';
UPDATE public.group_predictions SET pred_1st = 'Brazil' WHERE pred_1st = 'Brasil';
UPDATE public.group_predictions SET pred_1st = 'France' WHERE pred_1st = 'França';
UPDATE public.group_predictions SET pred_1st = 'Germany' WHERE pred_1st = 'Alemanya';
UPDATE public.group_predictions SET pred_1st = 'Netherlands' WHERE pred_1st = 'Països Baixos';
UPDATE public.group_predictions SET pred_1st = 'England' WHERE pred_1st = 'Anglaterra';
UPDATE public.group_predictions SET pred_1st = 'Scotland' WHERE pred_1st = 'Escòcia';
UPDATE public.group_predictions SET pred_1st = 'Wales' WHERE pred_1st = 'Gal·les';
UPDATE public.group_predictions SET pred_1st = 'Australia' WHERE pred_1st = 'Austràlia';
UPDATE public.group_predictions SET pred_1st = 'Australia' WHERE pred_1st = 'Australia';
UPDATE public.group_predictions SET pred_1st = 'Austria' WHERE pred_1st = 'Àustria';
UPDATE public.group_predictions SET pred_1st = 'Belgium' WHERE pred_1st = 'Bèlgica';
UPDATE public.group_predictions SET pred_1st = 'Bosnia-Herzegovina' WHERE pred_1st = 'Bòsnia i Herzegovina';
UPDATE public.group_predictions SET pred_1st = 'Cape Verde' WHERE pred_1st = 'Cap Verd';
UPDATE public.group_predictions SET pred_1st = 'Croatia' WHERE pred_1st = 'Croàcia';
UPDATE public.group_predictions SET pred_1st = 'Egypt' WHERE pred_1st = 'Egipte';
UPDATE public.group_predictions SET pred_1st = 'Greece' WHERE pred_1st = 'Grècia';
UPDATE public.group_predictions SET pred_1st = 'Japan' WHERE pred_1st = 'Japó';
UPDATE public.group_predictions SET pred_1st = 'Morocco' WHERE pred_1st = 'Marroc';
UPDATE public.group_predictions SET pred_1st = 'Norway' WHERE pred_1st = 'Noruega';
UPDATE public.group_predictions SET pred_1st = 'Panama' WHERE pred_1st = 'Panamà';
UPDATE public.group_predictions SET pred_1st = 'Saudi Arabia' WHERE pred_1st = 'Aràbia Saudita';
UPDATE public.group_predictions SET pred_1st = 'South Africa' WHERE pred_1st = 'Sud-àfrica';
UPDATE public.group_predictions SET pred_1st = 'South Korea' WHERE pred_1st = 'Corea del Sud';
UPDATE public.group_predictions SET pred_1st = 'Sweden' WHERE pred_1st = 'Suècia';
UPDATE public.group_predictions SET pred_1st = 'Switzerland' WHERE pred_1st = 'Suïssa';
UPDATE public.group_predictions SET pred_1st = 'Tunisia' WHERE pred_1st = 'Tunísia';
UPDATE public.group_predictions SET pred_1st = 'Turkey' WHERE pred_1st = 'Turquia';
UPDATE public.group_predictions SET pred_1st = 'United States' WHERE pred_1st = 'Estats Units';
UPDATE public.group_predictions SET pred_1st = 'Mexico' WHERE pred_1st = 'Mèxic';
UPDATE public.group_predictions SET pred_1st = 'Czechia' WHERE pred_1st = 'Txèquia';
UPDATE public.group_predictions SET pred_1st = 'Ivory Coast' WHERE pred_1st = 'Costa d''Ivori' OR pred_1st = 'Costa d&#39;Ivori';
UPDATE public.group_predictions SET pred_1st = 'Uruguay' WHERE pred_1st = 'Urugay';
UPDATE public.group_predictions SET pred_1st = 'Haiti' WHERE pred_1st = 'Haití';
UPDATE public.group_predictions SET pred_1st = 'Jordan' WHERE pred_1st = 'Jordania';
UPDATE public.group_predictions SET pred_1st = 'New Zealand' WHERE pred_1st = 'Nova Zelanda';
UPDATE public.group_predictions SET pred_1st = 'Paraguay' WHERE pred_1st = 'Paraguai';
UPDATE public.group_predictions SET pred_1st = 'DR Congo' WHERE pred_1st = 'RD Congo';
UPDATE public.group_predictions SET pred_1st = 'Algeria' WHERE pred_1st = 'Algèria';
UPDATE public.group_predictions SET pred_1st = 'Colombia' WHERE pred_1st = 'Colòmbia';
UPDATE public.group_predictions SET pred_1st = 'Canada' WHERE pred_1st = 'Canadà';

-- Mateixos canvis per pred_2nd i pred_3rd
UPDATE public.group_predictions SET pred_2nd = 'Spain' WHERE pred_2nd = 'Espanya';
UPDATE public.group_predictions SET pred_2nd = 'Brazil' WHERE pred_2nd = 'Brasil';
UPDATE public.group_predictions SET pred_2nd = 'France' WHERE pred_2nd = 'França';
UPDATE public.group_predictions SET pred_2nd = 'Germany' WHERE pred_2nd = 'Alemanya';
UPDATE public.group_predictions SET pred_2nd = 'Netherlands' WHERE pred_2nd = 'Països Baixos';
UPDATE public.group_predictions SET pred_2nd = 'England' WHERE pred_2nd = 'Anglaterra';
UPDATE public.group_predictions SET pred_2nd = 'Scotland' WHERE pred_2nd = 'Escòcia';
UPDATE public.group_predictions SET pred_2nd = 'Wales' WHERE pred_2nd = 'Gal·les';
UPDATE public.group_predictions SET pred_2nd = 'Australia' WHERE pred_2nd = 'Austràlia' OR pred_2nd = 'Australia';
UPDATE public.group_predictions SET pred_2nd = 'Austria' WHERE pred_2nd = 'Àustria';
UPDATE public.group_predictions SET pred_2nd = 'Belgium' WHERE pred_2nd = 'Bèlgica';
UPDATE public.group_predictions SET pred_2nd = 'Bosnia-Herzegovina' WHERE pred_2nd = 'Bòsnia i Herzegovina';
UPDATE public.group_predictions SET pred_2nd = 'Cape Verde' WHERE pred_2nd = 'Cap Verd';
UPDATE public.group_predictions SET pred_2nd = 'Croatia' WHERE pred_2nd = 'Croàcia';
UPDATE public.group_predictions SET pred_2nd = 'Egypt' WHERE pred_2nd = 'Egipte';
UPDATE public.group_predictions SET pred_2nd = 'Greece' WHERE pred_2nd = 'Grècia';
UPDATE public.group_predictions SET pred_2nd = 'Japan' WHERE pred_2nd = 'Japó';
UPDATE public.group_predictions SET pred_2nd = 'Morocco' WHERE pred_2nd = 'Marroc';
UPDATE public.group_predictions SET pred_2nd = 'Norway' WHERE pred_2nd = 'Noruega';
UPDATE public.group_predictions SET pred_2nd = 'Panama' WHERE pred_2nd = 'Panamà';
UPDATE public.group_predictions SET pred_2nd = 'Saudi Arabia' WHERE pred_2nd = 'Aràbia Saudita';
UPDATE public.group_predictions SET pred_2nd = 'South Africa' WHERE pred_2nd = 'Sud-àfrica';
UPDATE public.group_predictions SET pred_2nd = 'South Korea' WHERE pred_2nd = 'Corea del Sud';
UPDATE public.group_predictions SET pred_2nd = 'Sweden' WHERE pred_2nd = 'Suècia';
UPDATE public.group_predictions SET pred_2nd = 'Switzerland' WHERE pred_2nd = 'Suïssa';
UPDATE public.group_predictions SET pred_2nd = 'Tunisia' WHERE pred_2nd = 'Tunísia';
UPDATE public.group_predictions SET pred_2nd = 'Turkey' WHERE pred_2nd = 'Turquia';
UPDATE public.group_predictions SET pred_2nd = 'United States' WHERE pred_2nd = 'Estats Units';
UPDATE public.group_predictions SET pred_2nd = 'Mexico' WHERE pred_2nd = 'Mèxic';
UPDATE public.group_predictions SET pred_2nd = 'Czechia' WHERE pred_2nd = 'Txèquia';
UPDATE public.group_predictions SET pred_2nd = 'Ivory Coast' WHERE pred_2nd = 'Costa d''Ivori';
UPDATE public.group_predictions SET pred_2nd = 'Uruguay' WHERE pred_2nd = 'Urugay';
UPDATE public.group_predictions SET pred_2nd = 'Haiti' WHERE pred_2nd = 'Haití';
UPDATE public.group_predictions SET pred_2nd = 'Jordan' WHERE pred_2nd = 'Jordania';
UPDATE public.group_predictions SET pred_2nd = 'New Zealand' WHERE pred_2nd = 'Nova Zelanda';
UPDATE public.group_predictions SET pred_2nd = 'Paraguay' WHERE pred_2nd = 'Paraguai';
UPDATE public.group_predictions SET pred_2nd = 'DR Congo' WHERE pred_2nd = 'RD Congo';
UPDATE public.group_predictions SET pred_2nd = 'Algeria' WHERE pred_2nd = 'Algèria';
UPDATE public.group_predictions SET pred_2nd = 'Colombia' WHERE pred_2nd = 'Colòmbia';
UPDATE public.group_predictions SET pred_2nd = 'Canada' WHERE pred_2nd = 'Canadà';

UPDATE public.group_predictions SET pred_3rd = 'Spain' WHERE pred_3rd = 'Espanya';
UPDATE public.group_predictions SET pred_3rd = 'Brazil' WHERE pred_3rd = 'Brasil';
UPDATE public.group_predictions SET pred_3rd = 'France' WHERE pred_3rd = 'França';
UPDATE public.group_predictions SET pred_3rd = 'Germany' WHERE pred_3rd = 'Alemanya';
UPDATE public.group_predictions SET pred_3rd = 'Netherlands' WHERE pred_3rd = 'Països Baixos';
UPDATE public.group_predictions SET pred_3rd = 'England' WHERE pred_3rd = 'Anglaterra';
UPDATE public.group_predictions SET pred_3rd = 'Scotland' WHERE pred_3rd = 'Escòcia';
UPDATE public.group_predictions SET pred_3rd = 'Wales' WHERE pred_3rd = 'Gal·les';
UPDATE public.group_predictions SET pred_3rd = 'Australia' WHERE pred_3rd = 'Austràlia' OR pred_3rd = 'Australia';
UPDATE public.group_predictions SET pred_3rd = 'Austria' WHERE pred_3rd = 'Àustria';
UPDATE public.group_predictions SET pred_3rd = 'Belgium' WHERE pred_3rd = 'Bèlgica';
UPDATE public.group_predictions SET pred_3rd = 'Bosnia-Herzegovina' WHERE pred_3rd = 'Bòsnia i Herzegovina';
UPDATE public.group_predictions SET pred_3rd = 'Cape Verde' WHERE pred_3rd = 'Cap Verd';
UPDATE public.group_predictions SET pred_3rd = 'Croatia' WHERE pred_3rd = 'Croàcia';
UPDATE public.group_predictions SET pred_3rd = 'Egypt' WHERE pred_3rd = 'Egipte';
UPDATE public.group_predictions SET pred_3rd = 'Greece' WHERE pred_3rd = 'Grècia';
UPDATE public.group_predictions SET pred_3rd = 'Japan' WHERE pred_3rd = 'Japó';
UPDATE public.group_predictions SET pred_3rd = 'Morocco' WHERE pred_3rd = 'Marroc';
UPDATE public.group_predictions SET pred_3rd = 'Norway' WHERE pred_3rd = 'Noruega';
UPDATE public.group_predictions SET pred_3rd = 'Panama' WHERE pred_3rd = 'Panamà';
UPDATE public.group_predictions SET pred_3rd = 'Saudi Arabia' WHERE pred_3rd = 'Aràbia Saudita';
UPDATE public.group_predictions SET pred_3rd = 'South Africa' WHERE pred_3rd = 'Sud-àfrica';
UPDATE public.group_predictions SET pred_3rd = 'South Korea' WHERE pred_3rd = 'Corea del Sud';
UPDATE public.group_predictions SET pred_3rd = 'Sweden' WHERE pred_3rd = 'Suècia';
UPDATE public.group_predictions SET pred_3rd = 'Switzerland' WHERE pred_3rd = 'Suïssa';
UPDATE public.group_predictions SET pred_3rd = 'Tunisia' WHERE pred_3rd = 'Tunísia';
UPDATE public.group_predictions SET pred_3rd = 'Turkey' WHERE pred_3rd = 'Turquia';
UPDATE public.group_predictions SET pred_3rd = 'United States' WHERE pred_3rd = 'Estats Units';
UPDATE public.group_predictions SET pred_3rd = 'Mexico' WHERE pred_3rd = 'Mèxic';
UPDATE public.group_predictions SET pred_3rd = 'Czechia' WHERE pred_3rd = 'Txèquia';
UPDATE public.group_predictions SET pred_3rd = 'Ivory Coast' WHERE pred_3rd = 'Costa d''Ivori';
UPDATE public.group_predictions SET pred_3rd = 'Uruguay' WHERE pred_3rd = 'Urugay';
UPDATE public.group_predictions SET pred_3rd = 'Haiti' WHERE pred_3rd = 'Haití';
UPDATE public.group_predictions SET pred_3rd = 'Jordan' WHERE pred_3rd = 'Jordania';
UPDATE public.group_predictions SET pred_3rd = 'New Zealand' WHERE pred_3rd = 'Nova Zelanda';
UPDATE public.group_predictions SET pred_3rd = 'Paraguay' WHERE pred_3rd = 'Paraguai';
UPDATE public.group_predictions SET pred_3rd = 'DR Congo' WHERE pred_3rd = 'RD Congo';
UPDATE public.group_predictions SET pred_3rd = 'Algeria' WHERE pred_3rd = 'Algèria';
UPDATE public.group_predictions SET pred_3rd = 'Colombia' WHERE pred_3rd = 'Colòmbia';
UPDATE public.group_predictions SET pred_3rd = 'Canada' WHERE pred_3rd = 'Canadà';

-- Champion predictions
UPDATE public.champion_predictions SET champion = 'Spain' WHERE champion = 'Espanya';
UPDATE public.champion_predictions SET champion = 'Brazil' WHERE champion = 'Brasil';
UPDATE public.champion_predictions SET champion = 'France' WHERE champion = 'França';
UPDATE public.champion_predictions SET champion = 'Germany' WHERE champion = 'Alemanya';
UPDATE public.champion_predictions SET champion = 'Netherlands' WHERE champion = 'Països Baixos';
UPDATE public.champion_predictions SET champion = 'England' WHERE champion = 'Anglaterra';
UPDATE public.champion_predictions SET champion = 'Argentina' WHERE champion = 'Argentina';
UPDATE public.champion_predictions SET champion = 'Portugal' WHERE champion = 'Portugal';
