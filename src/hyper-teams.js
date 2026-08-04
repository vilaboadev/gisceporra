/**
 * Dades dels equips de la Lliga Hypermotion (Segunda División) 2025-26.
 *
 * La clau és el nom intern (theSportDB o API-football).
 * Els IDs de theSportDB es poden actualitzar quan s'assignin equips als participants.
 *
 * Per afegir un equip nou, busca el seu ID a:
 *   https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=NomEquip
 */

export const HYPER_TEAMS = {
  'Ceuta': {
    id: '144243',
    displayName: 'AD Ceuta FC',
    shortName: 'CEU',
    crest: '⚪',
    stadium: 'Alfonso Murube',
    city: 'Ceuta',
  },
  'Albacete': {
    id: '134232',
    displayName: 'Albacete BP',
    shortName: 'ALB',
    crest: '⚪',
    stadium: 'Carlos Belmonte',
    city: 'Albacete',
  },
  'Burgos': {
    id: '138161',
    displayName: 'Burgos CF',
    shortName: 'BUR',
    crest: '⚫',
    stadium: 'El Plantío',
    city: 'Burgos',
  },
  'Cadiz': {
    id: '134222',
    displayName: 'Cádiz CF',
    shortName: 'CAD',
    crest: '🟡',
    stadium: 'Nuevo Mirandilla',
    city: 'Cadis',
  },
  'Castellon': {
    id: '138286',
    displayName: 'CD Castellón',
    shortName: 'CAS',
    crest: '⚫',
    stadium: 'Estadio Castalia',
    city: 'Castelló de la Plana',
  },
  'Eldense': {
    id: '144246',
    displayName: 'CD Eldense',
    shortName: 'ELD',
    crest: '🔴',
    stadium: 'Nou Pepico Amat',
    city: 'Elda',
  },
  'Leganes': {
    id: '134701',
    displayName: 'CD Leganés',
    shortName: 'LEG',
    crest: '🔵',
    stadium: 'Estadio Municipal de Butarque',
    city: 'Leganés',
  },
  'Tenerife': {
    id: '133840',
    displayName: 'CD Tenerife',
    shortName: 'TEN',
    crest: '🔵',
    stadium: 'Heliodoro Rodríguez López',
    city: 'Santa Cruz de Tenerife',
  },
  'Sabadell': {
    id: '134704',
    displayName: 'CE Sabadell',
    shortName: 'SAB',
    crest: '🔵',
    stadium: 'Nova Creu Alta',
    city: 'Sabadell',
  },
  'Celta Fortuna': {
    id: '137826',
    displayName: 'Celta Fortuna',
    shortName: 'CEL',
    crest: '🩵',
    stadium: 'Barreiro',
    city: 'Vigo',
  },
  'Cordoba': {
    id: '134627',
    displayName: 'Córdoba CF',
    shortName: 'COR',
    crest: '🟢',
    stadium: 'Estadio El Arcángel',
    city: 'Còrdova',
  },
  'Andorra': {
    id: '138280',
    displayName: 'FC Andorra',
    shortName: 'AND',
    crest: '🔵',
    stadium: 'Estadi Nacional',
    city: 'Andorra la Vella',
  },
  'Girona': {
    id: '134700',
    displayName: 'Girona FC',
    shortName: 'GIR',
    crest: '🔴',
    stadium: 'Montilivi',
    city: 'Girona',
  },
  'Granada': {
    id: '133721',
    displayName: 'Granada CF',
    shortName: 'GRA',
    crest: '🔴',
    stadium: 'Nuevo Los Cármenes',
    city: 'Granada',
  },
  'Real Sociedad B': {
    id: '138160',
    displayName: 'Real Sociedad B',
    shortName: 'RSO',
    crest: '🔵',
    stadium: 'Zubieta',
    city: 'Donostia',
  },
  'Mallorca': {
    id: '133733',
    displayName: 'RCD Mallorca',
    shortName: 'MAL',
    crest: '🔴',
    stadium: 'Son Moix',
    city: 'Palma',
  },
  'Oviedo': {
    id: '135455',
    displayName: 'Real Oviedo',
    shortName: 'OVI',
    crest: '🔵',
    stadium: 'Carlos Tartiere',
    city: 'Oviedo',
  },
  'Sporting': {
    id: '133723',
    displayName: 'Real Sporting',
    shortName: 'SPO',
    crest: '🔴',
    stadium: 'El Molinón - Enrique Castro Quini',
    city: 'Gijón',
  },
  'Valladolid': {
    id: '133841',
    displayName: 'Real Valladolid CF',
    shortName: 'VLL',
    crest: '🟣',
    stadium: 'José Zorrilla',
    city: 'Valladolid',
  },
  'Eibar': {
    id: '134626',
    displayName: 'SD Eibar',
    shortName: 'EIB',
    crest: '🔴',
    stadium: 'Ipurua',
    city: 'Eibar',
  },
  'Almeria': {
    id: '133817',
    displayName: 'UD Almería',
    shortName: 'ALM',
    crest: '🔴',
    stadium: 'Power Horse Stadium',
    city: 'Almeria',
  },
  'Las Palmas': {
    id: '134259',
    displayName: 'UD Las Palmas',
    shortName: 'LPA',
    crest: '🟡',
    stadium: 'Estadio de Gran Canaria',
    city: 'Las Palmas de Gran Canaria',
  },
};

/**
 * Retorna la informació de l'equip pel nom o per l'ID de theSportDB.
 * @param {string} teamIdOrName  ID de theSportDB o nom intern
 * @returns {object|null}
 */
export function getTeamInfo(teamIdOrName) {
  if (!teamIdOrName) return null;
  // Try by direct key (internal name)
  if (HYPER_TEAMS[teamIdOrName]) return { ...HYPER_TEAMS[teamIdOrName], key: teamIdOrName };
  // Try by theSportDB ID
  const entry = Object.entries(HYPER_TEAMS).find(([, t]) => t.id === String(teamIdOrName));
  if (entry) return { ...entry[1], key: entry[0] };
  return null;
}

/** Llista de noms interns dels equips (per als selectors d'admin). */
export const HYPER_TEAM_NAMES = Object.keys(HYPER_TEAMS);
