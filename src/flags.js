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
 * @param {string} teamName
 * @returns {string}
 */
export function teamWithFlag(teamName) {
  const flag = getFlag(teamName);
  if (!flag) return teamName ?? '';
  return `${flag} ${teamName}`;
}
