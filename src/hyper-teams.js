/**
 * Dades dels equips de la Lliga Hypermotion (Segunda División) 2026-27.
 *
 * La clau és el nom intern. Els IDs d'ESPN s'utilitzen per identificar els equips a l'API pública.
 */

export const HYPER_TEAMS = {
  'Ceuta': {
    id: '5404',
    tsdbId: '144243',
    displayName: 'AD Ceuta FC',
    shortName: 'CEU',
    crest: '⚪',
    stadium: 'Alfonso Murube',
    city: 'Ceuta',
  },
  'Albacete': {
    id: '2737',
    tsdbId: '134232',
    displayName: 'Albacete BP',
    shortName: 'ALB',
    crest: '⚪',
    stadium: 'Carlos Belmonte',
    city: 'Albacete',
  },
  'Burgos': {
    id: '12597',
    tsdbId: '138161',
    displayName: 'Burgos CF',
    shortName: 'BUR',
    crest: '⚫',
    stadium: 'El Plantío',
    city: 'Burgos',
  },
  'Cadiz': {
    id: '3842',
    tsdbId: '134222',
    displayName: 'Cádiz CF',
    shortName: 'CAD',
    crest: '🟡',
    stadium: 'Nuevo Mirandilla',
    city: 'Cadis',
  },
  'Castellon': {
    id: '4438',
    tsdbId: '138286',
    displayName: 'CD Castellón',
    shortName: 'CAS',
    crest: '⚫',
    stadium: 'Estadio Castalia',
    city: 'Castelló de la Plana',
  },
  'Eldense': {
    id: '7320',
    tsdbId: '144246',
    displayName: 'CD Eldense',
    shortName: 'ELD',
    crest: '🔴',
    stadium: 'Nou Pepico Amat',
    city: 'Elda',
  },
  'Leganes': {
    id: '17534',
    tsdbId: '134701',
    displayName: 'CD Leganés',
    shortName: 'LEG',
    crest: '🔵',
    stadium: 'Estadio Municipal de Butarque',
    city: 'Leganés',
  },
  'Tenerife': {
    id: '245',
    tsdbId: '133840',
    displayName: 'CD Tenerife',
    shortName: 'TEN',
    crest: '🔵',
    stadium: 'Heliodoro Rodríguez López',
    city: 'Santa Cruz de Tenerife',
  },
  'Sabadell': {
    id: '11487',
    tsdbId: '134704',
    displayName: 'CE Sabadell',
    shortName: 'CDS',
    crest: '🔵',
    stadium: 'Nova Creu Alta',
    city: 'Sabadell',
  },
  'Celta Fortuna': {
    id: '131858',
    tsdbId: '137826',
    displayName: 'Celta Fortuna',
    shortName: 'CEL',
    crest: '🩵',
    stadium: 'Barreiro',
    city: 'Vigo',
  },
  'Cordoba': {
    id: '8447',
    tsdbId: '134627',
    displayName: 'Córdoba CF',
    shortName: 'COR',
    crest: '🟢',
    stadium: 'Estadio El Arcángel',
    city: 'Còrdova',
  },
  'Andorra': {
    id: '20179',
    tsdbId: '138280',
    displayName: 'FC Andorra',
    shortName: 'AND',
    crest: '🔵',
    stadium: 'Estadi Nacional',
    city: 'Andorra la Vella',
  },
  'Girona': {
    id: '9812',
    tsdbId: '134700',
    displayName: 'Girona FC',
    shortName: 'GIR',
    crest: '🔴',
    stadium: 'Montilivi',
    city: 'Girona',
  },
  'Granada': {
    id: '3747',
    tsdbId: '133721',
    displayName: 'Granada CF',
    shortName: 'GRA',
    crest: '🔴',
    stadium: 'Nuevo Los Cármenes',
    city: 'Granada',
  },
  'Real Sociedad B': {
    id: '20983',
    tsdbId: '138160',
    displayName: 'Real Sociedad B',
    shortName: 'RSO2',
    crest: '🔵',
    stadium: 'Zubieta',
    city: 'Donostia',
  },
  'Mallorca': {
    id: '84',
    tsdbId: '133733',
    displayName: 'RCD Mallorca',
    shortName: 'MLL',
    crest: '🔴',
    stadium: 'Son Moix',
    city: 'Palma',
  },
  'Oviedo': {
    id: '92',
    tsdbId: '135455',
    displayName: 'Real Oviedo',
    shortName: 'OVI',
    crest: '🔵',
    stadium: 'Carlos Tartiere',
    city: 'Oviedo',
  },
  'Sporting': {
    id: '3788',
    tsdbId: '133723',
    displayName: 'Real Sporting',
    shortName: 'RSG',
    crest: '🔴',
    stadium: 'El Molinón - Enrique Castro Quini',
    city: 'Gijón',
  },
  'Valladolid': {
    id: '95',
    tsdbId: '133841',
    displayName: 'Real Valladolid CF',
    shortName: 'VLL',
    crest: '🟣',
    stadium: 'José Zorrilla',
    city: 'Valladolid',
  },
  'Eibar': {
    id: '3752',
    tsdbId: '134626',
    displayName: 'SD Eibar',
    shortName: 'EIB',
    crest: '🔴',
    stadium: 'Ipurua',
    city: 'Eibar',
  },
  'Almeria': {
    id: '6832',
    tsdbId: '133817',
    displayName: 'UD Almería',
    shortName: 'ALM',
    crest: '🔴',
    stadium: 'Power Horse Stadium',
    city: 'Almeria',
  },
  'Las Palmas': {
    id: '98',
    tsdbId: '134259',
    displayName: 'UD Las Palmas',
    shortName: 'LPA',
    crest: '🟡',
    stadium: 'Estadio de Gran Canaria',
    city: 'Las Palmas de Gran Canaria',
  },
};

/**
 * Retorna la informació de l'equip pel nom intern, nom visible, ID d'ESPN o ID antic de TSDB.
 * @param {string} teamIdOrName  ID d'ESPN / TSDB o nom intern
 * @returns {object|null}
 */
export function getTeamInfo(teamIdOrName) {
  if (!teamIdOrName) return null;
  const str = String(teamIdOrName);
  // Try by direct key (internal name)
  if (HYPER_TEAMS[str]) return { ...HYPER_TEAMS[str], key: str };
  // Try by ESPN ID or legacy TSDB ID or displayName
  const entry = Object.entries(HYPER_TEAMS).find(
    ([, t]) => t.id === str || t.tsdbId === str || t.displayName === str
  );
  if (entry) return { ...entry[1], key: entry[0] };
  return null;
}

/** Llista de noms interns dels equips (per als selectors d'admin). */
export const HYPER_TEAM_NAMES = Object.keys(HYPER_TEAMS);
