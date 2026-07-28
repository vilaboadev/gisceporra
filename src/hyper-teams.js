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
  'Almeria': {
    id: '134133',
    displayName: 'Almería',
    shortName: 'ALM',
    crest: '🔴',
    stadium: 'Power Horse Stadium',
    city: 'Almeria',
  },
  'Levante': {
    id: '134134',
    displayName: 'Levante UD',
    shortName: 'LEV',
    crest: '🔵',
    stadium: 'Estadio Ciudad de Valencia',
    city: 'València',
  },
  'Deportivo Alaves': {
    id: '134135',
    displayName: 'Deportivo Alavés',
    shortName: 'ALA',
    crest: '🔵',
    stadium: 'Mendizorroza',
    city: 'Vitoria-Gasteiz',
  },
  'Mirandes': {
    id: '134136',
    displayName: 'CD Mirandés',
    shortName: 'MIR',
    crest: '🔴',
    stadium: 'Estadio Municipal de Anduva',
    city: 'Miranda de Ebro',
  },
  'Huesca': {
    id: '134137',
    displayName: 'SD Huesca',
    shortName: 'HUE',
    crest: '🔵',
    stadium: 'El Alcoraz',
    city: 'Huesca',
  },
  'Zaragoza': {
    id: '134138',
    displayName: 'Real Zaragoza',
    shortName: 'ZAR',
    crest: '⚪',
    stadium: 'La Romareda',
    city: 'Saragossa',
  },
  'Racing Santander': {
    id: '134139',
    displayName: 'Racing de Santander',
    shortName: 'RAC',
    crest: '🟢',
    stadium: 'El Sardinero',
    city: 'Santander',
  },
  'Burgos': {
    id: '134140',
    displayName: 'Burgos CF',
    shortName: 'BUR',
    crest: '⚫',
    stadium: 'El Plantío',
    city: 'Burgos',
  },
  'Eldense': {
    id: '134141',
    displayName: 'CD Eldense',
    shortName: 'ELD',
    crest: '🔴',
    stadium: 'Nou Pepico Amat',
    city: 'Elda',
  },
  'Tenerife': {
    id: '134142',
    displayName: 'CD Tenerife',
    shortName: 'TEN',
    crest: '🔵',
    stadium: 'Heliodoro Rodríguez López',
    city: 'Santa Cruz de Tenerife',
  },
  'Cartagena': {
    id: '134143',
    displayName: 'FC Cartagena',
    shortName: 'CAR',
    crest: '⚫',
    stadium: 'Estadio Cartagonova',
    city: 'Cartagena',
  },
  'Castellon': {
    id: '134144',
    displayName: 'CD Castellón',
    shortName: 'CAS',
    crest: '⚫',
    stadium: 'Estadio Castalia',
    city: 'Castelló de la Plana',
  },
  'Ferrol': {
    id: '134145',
    displayName: 'Racing de Ferrol',
    shortName: 'FER',
    crest: '⚫',
    stadium: 'A Malata',
    city: 'Ferrol',
  },
  'Malaga': {
    id: '134146',
    displayName: 'Málaga CF',
    shortName: 'MAL',
    crest: '🔵',
    stadium: 'La Rosaleda',
    city: 'Màlaga',
  },
  'Numancia': {
    id: '134147',
    displayName: 'CD Numancia',
    shortName: 'NUM',
    crest: '🔴',
    stadium: 'Los Pajaritos',
    city: 'Soria',
  },
  'Ibiza': {
    id: '134148',
    displayName: 'UD Ibiza',
    shortName: 'IBI',
    crest: '🔴',
    stadium: 'Can Misses',
    city: 'Eivissa',
  },
  'Cordoba': {
    id: '134149',
    displayName: 'Córdoba CF',
    shortName: 'COR',
    crest: '⚪',
    stadium: 'Estadio El Arcángel',
    city: 'Còrdova',
  },
  'Leganes': {
    id: '134150',
    displayName: 'CD Leganés',
    shortName: 'LEG',
    crest: '🔵',
    stadium: 'Estadio Municipal de Butarque',
    city: 'Leganés',
  },
  'Albacete': {
    id: '134151',
    displayName: 'Albacete BP',
    shortName: 'ALB',
    crest: '🟡',
    stadium: 'Carlos Belmonte',
    city: 'Albacete',
  },
  'Deportivo': {
    id: '134152',
    displayName: 'Deportivo de La Coruña',
    shortName: 'DEP',
    crest: '⚪',
    stadium: 'Abanca-Riazor',
    city: 'A Coruña',
  },
  'Oviedo': {
    id: '134153',
    displayName: 'Real Oviedo',
    shortName: 'OVI',
    crest: '🔵',
    stadium: 'Carlos Tartiere',
    city: 'Oviedo',
  },
  'Valladolid': {
    id: '134154',
    displayName: 'Real Valladolid',
    shortName: 'VLL',
    crest: '🟣',
    stadium: 'José Zorrilla',
    city: 'Valladolid',
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
