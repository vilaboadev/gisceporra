const KNOCKOUT_POINTS = {
  dieciseisavos: { winner: 10, exact: 20 },
  octavos: { winner: 10, exact: 20 },
  setzens: { winner: 10, exact: 20 },
  vuitens: { winner: 10, exact: 20 },
  ROUND_OF_32: { winner: 10, exact: 20 },
  ROUND_OF_16: { winner: 10, exact: 20 },
  quarter_finals: { winner: 15, exact: 30 },
  quarts: { winner: 15, exact: 30 },
  QUARTER_FINALS: { winner: 15, exact: 30 },
  semi_finals: { winner: 20, exact: 40 },
  semifinals: { winner: 20, exact: 40 },
  SEMI_FINALS: { winner: 20, exact: 40 },
  THIRD_PLACE: { winner: 20, exact: 40 },
  final: { winner: 30, exact: 50 },
  FINAL: { winner: 30, exact: 50 },
};

export function calculateGroupPoints(predictedTop3 = [], actualTop3 = []) {
  return predictedTop3.reduce((acc, team, index) => {
    if (!actualTop3.includes(team)) return acc;
    return acc + 5 + (actualTop3[index] === team ? 5 : 0);
  }, 0);
}

/**
 * Retorna desglossament per equip de la puntuació d'un grup.
 * @param {string[]} actualOrder - L'ordre real complet (1r, 2n, 3r, 4t...)
 * @param {{pred_1st?: string, pred_2nd?: string, pred_3rd?: string}} prediction
 * @returns {{position: number, team: string, predicted: number|null, points: number, classified: boolean}[]}
 */
export function calculateGroupPointsDetailed(actualOrder = [], prediction = {}) {
  const predMap = {
    1: prediction.pred_1st,
    2: prediction.pred_2nd,
    3: prediction.pred_3rd,
  };
  const predToPos = {};
  for (const [pos, team] of Object.entries(predMap)) {
    if (team) predToPos[team] = Number(pos);
  }

  const actualTop3 = actualOrder.slice(0, 3);

  return actualOrder.map((team, i) => {
    const position = i + 1;
    const predicted = predToPos[team] ?? null;
    const inTop3 = actualTop3.includes(team);
    const exact = predicted === position;
    let points = 0;
    if (inTop3 && predicted !== null) points += 5;
    if (exact) points += 5;
    return {
      position,
      team,
      predicted,
      points,
      classified: position <= 2,
    };
  });
}

export function calculateKnockoutPoints(prediction, result) {
  if (!prediction || !result) return 0;
  const round = KNOCKOUT_POINTS[result.round] ?? { winner: 0, exact: 0 };
  const predictedWinner =
    prediction.homeGoals === prediction.awayGoals
      ? prediction.tieWinner
      : prediction.homeGoals > prediction.awayGoals
      ? result.homeTeam
      : result.awayTeam;

  const winnerPoints = predictedWinner === result.winner ? round.winner : 0;
  const exactPoints =
    prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals
      ? round.exact
      : 0;

  return winnerPoints + exactPoints;
}

export function calculateCrystalBallPoints(predictedChampion, actualChampion) {
  return predictedChampion && actualChampion && predictedChampion === actualChampion ? 100 : 0;
}

export function calculateUserTotal(
  { groupPredictions = [], bets = [], champion },
  { groups = [], matches = [], champion: actualChampion },
) {
  const groupPoints = groupPredictions.reduce((sum, prediction) => {
    const groupResult = groups.find((group) => group.groupName === prediction.groupName);
    if (!groupResult) return sum;
    return sum + calculateGroupPoints(prediction.top3, groupResult.top3);
  }, 0);

  const knockoutPoints = bets.reduce((sum, bet) => {
    const matchResult = matches.find((match) => match.id === bet.matchId);
    return sum + calculateKnockoutPoints(bet, matchResult);
  }, 0);

  return groupPoints + knockoutPoints + calculateCrystalBallPoints(champion, actualChampion);
}
