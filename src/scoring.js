const KNOCKOUT_POINTS = {
  dieciseisavos: { winner: 10, exact: 20 },
  octavos: { winner: 10, exact: 20 },
  setzens: { winner: 10, exact: 20 },
  vuitens: { winner: 10, exact: 20 },
  quarter_finals: { winner: 15, exact: 30 },
  quarts: { winner: 15, exact: 30 },
  semi_finals: { winner: 20, exact: 40 },
  semifinals: { winner: 20, exact: 40 },
  final: { winner: 30, exact: 50 },
};

export function calculateGroupPoints(predictedTop3 = [], actualTop3 = []) {
  return predictedTop3.reduce((acc, team, index) => {
    if (!actualTop3.includes(team)) return acc;
    return acc + 5 + (actualTop3[index] === team ? 10 : 0);
  }, 0);
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
