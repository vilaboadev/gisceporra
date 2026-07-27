/**
 * Càlcul de punts per a la Porra-League Hypermotion.
 *
 * Sistema de puntuació:
 *   3 pts → resultat exacte (ex: predia 2-1 i queda 2-1)
 *   1 pt  → signe correcte però no exacte (ex: predia 0-0 i queda 1-1)
 *   0 pts → signe incorrecte
 */

/**
 * Calcula els punts d'un pronòstic per a un partit de la Lliga Hypermotion.
 * @param {{ pred_home: number|string, pred_away: number|string }|null} prediction
 * @param {{ home_goals: number|null, away_goals: number|null }|null} result
 * @returns {number} 0, 1 o 3 punts
 */
export function calculateHyperMatchPoints(prediction, result) {
  if (!prediction) return 0;
  if (result?.home_goals == null || result?.away_goals == null) return 0;

  const predHome = Number(prediction.pred_home);
  const predAway = Number(prediction.pred_away);
  const realHome = Number(result.home_goals);
  const realAway = Number(result.away_goals);

  if (!Number.isFinite(predHome) || !Number.isFinite(predAway)) return 0;
  if (!Number.isFinite(realHome) || !Number.isFinite(realAway)) return 0;

  if (predHome === realHome && predAway === realAway) return 3;

  const predSign = Math.sign(predHome - predAway);
  const realSign = Math.sign(realHome - realAway);
  if (predSign === realSign) return 1;

  return 0;
}

/**
 * Retorna la classe CSS de la boleta de punts.
 * @param {number} points  0, 1 o 3
 * @returns {'pts-green'|'pts-orange'|'pts-grey'}
 */
export function getHyperBadgeColor(points) {
  if (points === 3) return 'pts-green';
  if (points === 1) return 'pts-orange';
  return 'pts-grey';
}

/**
 * Calcula el total de punts d'un usuari a partir de les seves prediccions i resultats reals.
 * @param {Array<{ match_key: string, pred_home: number, pred_away: number }>} predictions
 * @param {Array<{ match_key: string, home_goals: number|null, away_goals: number|null }>} results
 * @returns {number}
 */
export function calculateHyperUserTotal(predictions = [], results = []) {
  const resultMap = new Map(results.map(r => [r.match_key, r]));
  return predictions.reduce((sum, pred) => {
    const result = resultMap.get(pred.match_key) ?? null;
    return sum + calculateHyperMatchPoints(pred, result);
  }, 0);
}
