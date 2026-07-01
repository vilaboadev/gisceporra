export function buildRankingFromCache({ participants = [], classification = [], currentUsername = null } = {}) {
  const participantsList = (participants ?? []).filter(
    (p) => p.username !== 'TST' || currentUsername === 'TST'
  );

  const pointsByUser = new Map(
    (classification ?? []).map((row) => [row.username, Number(row.puntos) || 0])
  );

  return participantsList
    .map((p) => ({
      username: p.username,
      displayName: p.display_name,
      points: pointsByUser.get(p.username) ?? 0,
    }))
    .sort((a, b) => b.points - a.points);
}
