/* Standard ELO, K=32. Pure. */
const K = 32;

export function eloDelta(winnerElo: number, loserElo: number): number {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.round(K * (1 - expected));
}

export function applyElo(winnerElo: number, loserElo: number) {
  const delta = eloDelta(winnerElo, loserElo);
  return {
    winner: { before: winnerElo, after: winnerElo + delta, delta },
    loser: { before: loserElo, after: loserElo - delta, delta: -delta },
  };
}
