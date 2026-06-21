// Mapeig de noms d'equip ESPN → emoji de bandera
// Cobreix tots els 48 equips del Mundial 2026
const FLAG_MAP = {
  // Grup A
  'United States':          '🇺🇸',
  'USA':                    '🇺🇸',
  // Grup B
  'Mexico':                 '🇲🇽',
  // Grup C
  'Canada':                 '🇨🇦',
  // Grup D
  'Uruguay':                '🇺🇾',
  // Grup E
  'Spain':                  '🇪🇸',
  'Espanya':                '🇪🇸',
  // Grup F
  'Brazil':                 '🇧🇷',
  'Brasil':                 '🇧🇷',
  // Grup G
  'Argentina':              '🇦🇷',
  // Grup H
  'France':                 '🇫🇷',
  'França':                 '🇫🇷',
  // Grup I
  'Germany':                '🇩🇪',
  'Alemanya':               '🇩🇪',
  // Grup J
  'Portugal':               '🇵🇹',
  // Grup K
  'Netherlands':            '🇳🇱',
  'Holland':                '🇳🇱',
  // Grup L
  'England':                '🏴󠁧󠁢󠁥󠁮󠁧󁿢',
  'Anglaterra':             '🏴󠁧󠁢󠁥󠁮󠁧󁿢',

  // Resta d'equips (ordre alfabètic)
  'Albania':                '🇦🇱',
  'Algeria':                '🇩🇿',
  'Angola':                 '🇦🇴',
  'Australia':              '🇦🇺',
  'Austràlia':              '🇦🇺',
  'Austria':                '🇦🇹',
  'Àustria':                '🇦🇹',
  'Belgium':                '🇧🇪',
  'Bèlgica':                '🇧🇪',
  'Bolivia':                '🇧🇴',
  'Bosnia-Herzegovina':     '🇧🇦',
  'Bosnia i Herzegovina':   '🇧🇦',
  'Cameroon':               '🇨🇲',
  'Cape Verde':             '🇨🇻',
  'Cap Verd':               '🇨🇻',
  'Chile':                  '🇨🇱',
  'China':                  '🇨🇳',
  'Colombia':               '🇨🇴',
  'Congo DR':               '🇨🇩',
  'DR Congo':               '🇨🇩',
  'Costa Rica':             '🇨🇷',
  'Croatia':                '🇭🇷',
  'Croàcia':                '🇭🇷',
  'Cuba':                   '🇨🇺',
  'Curaçao':                '🇨🇼',
  'Czechia':                '🇨🇿',
  'Czech Republic':         '🇨🇿',
  'Ecuador':                '🇪🇨',
  'Egypt':                  '🇪🇬',
  'Egipte':                 '🇪🇬',
  'El Salvador':            '🇸🇻',
  'Ghana':                  '🇬🇭',
  'Greece':                 '🇬🇷',
  'Grècia':                 '🇬🇷',
  'Guinea':                 '🇬🇳',
  'Haiti':                  '🇭🇹',
  'Honduras':               '🇭🇳',
  'Hungary':                '🇭🇺',
  'Indonesia':              '🇮🇩',
  'Iran':                   '🇮🇷',
  'Iraq':                   '🇮🇶',
  'Ivory Coast':            '🇨🇮',
  "Côte d'Ivoire":          '🇨🇮',
  'Jamaica':                '🇯🇲',
  'Japan':                  '🇯🇵',
  'Japó':                   '🇯🇵',
  'Jordan':                 '🇯🇴',
  'Kenya':                  '🇰🇪',
  'Mali':                   '🇲🇱',
  'Mauritania':             '🇲🇷',
  'Morocco':                '🇲🇦',
  'Marroc':                 '🇲🇦',
  'New Zealand':            '🇳🇿',
  'Nigeria':                '🇳🇬',
  'North Korea':            '🇰🇵',
  'Norway':                 '🇳🇴',
  'Noruega':                '🇳🇴',
  'Panama':                 '🇵🇦',
  'Panamà':                 '🇵🇦',
  'Paraguay':               '🇵🇾',
  'Peru':                   '🇵🇪',
  'Qatar':                  '🇶🇦',
  'Romania':                '🇷🇴',
  'Saudi Arabia':           '🇸🇦',
  'Aràbia Saudita':         '🇸🇦',
  'Scotland':               '🏴󠁧󠁢󠁳󠁣󠁴󁿢',
  'Escòcia':                '🏴󠁧󠁢󠁳󠁣󠁴󁿢',
  'Senegal':                '🇸🇳',
  'Serbia':                 '🇷🇸',
  'Serbia i Montenegro':    '🇷🇸',
  'South Africa':           '🇿🇦',
  'Sud-àfrica':             '🇿🇦',
  'South Korea':            '🇰🇷',
  'Corea del Sud':          '🇰🇷',
  'Sweden':                 '🇸🇪',
  'Suècia':                 '🇸🇪',
  'Switzerland':            '🇨🇭',
  'Suïssa':                 '🇨🇭',
  'Thailand':               '🇹🇭',
  'Tunisia':                '🇹🇳',
  'Tunísia':                '🇹🇳',
  'Turkey':                 '🇹🇷',
  'Türkiye':                '🇹🇷',
  'Ukraine':                '🇺🇦',
  'Uzbekistan':             '🇺🇿',
  'Venezuela':              '🇻🇪',
  'Wales':                  '🏴󠁧󠁢󠁷󠁬󠁳󁿢',
  'Gal·les':                '🏴󠁧󠁢󠁷󠁬󠁳󁿢',
};

/**
 * Retorna l'emoji de bandera per un nom d'equip.
 * Si no es troba, retorna una cadena buida.
 * @param {string} teamName
 * @returns {string}
 */
export function getFlag(teamName) {
  if (!teamName) return '';
  return FLAG_MAP[teamName] ?? '';
}

/**
 * Retorna el nom de l'equip amb la bandera davant.
 * Si el nom és un placeholder d'ESPN (ex: "Group A 2nd Place"),
 * el converteix a format llegible en català.
 * @param {string} teamName
 * @returns {string}
 */
export function teamWithFlag(teamName) {
  if (!teamName) return '?';
  const readable = formatPlaceholder(teamName);
  if (readable !== teamName) return readable; // era placeholder
  const flag = getFlag(teamName);
  return flag ? `${flag} ${teamName}` : teamName;
}

/**
 * Converteix noms placeholder d'ESPN a text llegible en català.
 * Retorna el nom original si no és un placeholder conegut.
 */
export function formatPlaceholder(name) {
  if (!name) return '';

  // "Group A Winner" → "🏆 Grup A · 1r"
  const grpWinner = name.match(/^Group ([A-L]) Winner$/);
  if (grpWinner) return `🏆 Grup ${grpWinner[1]} · 1r`;

  // "Group A 1st Place" (per si de cas)
  const grp1st = name.match(/^Group ([A-L]) 1st Place$/);
  if (grp1st) return `🏆 Grup ${grp1st[1]} · 1r`;

  // "Group A 2nd Place" → "🥈 Grup A · 2n"
  const grp2nd = name.match(/^Group ([A-L]) 2nd Place$/);
  if (grp2nd) return `🥈 Grup ${grp2nd[1]} · 2n`;

  // "Group A 3rd Place" → "🥉 Grup A · 3r"
  const grp3rd = name.match(/^Group ([A-L]) 3rd Place$/);
  if (grp3rd) return `🥉 Grup ${grp3rd[1]} · 3r`;

  // "Third Place Group A/B/C/D/F" → "3rs millors A/B/C/D/F"
  const thirdGroups = name.match(/^Third Place Group ([A-L/]+)$/);
  if (thirdGroups) return `3rs millors (${thirdGroups[1]})`;

  // "Round of 32 N Winner" → "Setzen #N guanyador"
  const r32 = name.match(/^Round of 32 (\d+) Winner$/);
  if (r32) return `Setzens #${r32[1]}`;

  // "Round of 16 N Winner" → "Vuitens #N"
  const r16 = name.match(/^Round of 16 (\d+) Winner$/);
  if (r16) return `Vuitens #${r16[1]}`;

  // "Quarterfinal N Winner" → "Quarts #N"
  const qf = name.match(/^Quarterfinal (\d+) Winner$/);
  if (qf) return `Quarts #${qf[1]}`;

  // "Semifinal N Winner" → "Semi #N"
  const sfW = name.match(/^Semifinal (\d+) Winner$/);
  if (sfW) return `Semi #${sfW[1]}`;

  // "Semifinal N Loser" → "Semi #N (3r lloc)"
  const sfL = name.match(/^Semifinal (\d+) Loser$/);
  if (sfL) return `Semi #${sfL[1]} (3r lloc)`;

  return name; // nom real d'un país → sense canvis
}
