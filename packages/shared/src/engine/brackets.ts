/* Pure bracket generation. IDs are opaque strings (registration ids).
   All functions deterministic given inputs; no I/O. */

export type PairMatch = {
  round: number;
  bracketPos: number;
  bracket: "winners" | "losers" | "grand_final";
  p1: string | null; // null = bye/TBD
  p2: string | null;
};

/* --- round robin: circle method; every pair exactly once --- */
export function roundRobin(players: string[]): PairMatch[] {
  const list = [...players];
  if (list.length < 2) return [];
  const odd = list.length % 2 === 1;
  if (odd) list.push("__BYE__");
  const n = list.length;
  const rounds = n - 1;
  const matches: PairMatch[] = [];
  const rot = [...list];
  for (let r = 1; r <= rounds; r++) {
    let pos = 1;
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i];
      const b = rot[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") {
        matches.push({ round: r, bracketPos: pos++, bracket: "winners", p1: a, p2: b });
      }
    }
    /* rotate all but first */
    rot.splice(1, 0, rot.pop()!);
  }
  return matches;
}

/* --- single elimination: seeded, byes for non-power-of-two --- */
export function singleElim(seededPlayers: string[]): PairMatch[] {
  const n = seededPlayers.length;
  if (n < 2) return [];
  let size = 1;
  while (size < n) size *= 2;

  /* standard seeding order for bracket positions */
  function seedOrder(s: number): number[] {
    if (s === 1) return [1];
    const prev = seedOrder(s / 2);
    const out: number[] = [];
    for (const p of prev) {
      out.push(p);
      out.push(s + 1 - p);
    }
    return out;
  }
  const order = seedOrder(size);
  const slots: (string | null)[] = order.map((seed) =>
    seed <= n ? seededPlayers[seed - 1] : null,
  );

  const matches: PairMatch[] = [];
  const rounds = Math.log2(size);
  /* round 1 from slots; later rounds TBD */
  for (let i = 0; i < size / 2; i++) {
    matches.push({
      round: 1,
      bracketPos: i + 1,
      bracket: "winners",
      p1: slots[i * 2],
      p2: slots[i * 2 + 1],
    });
  }
  for (let r = 2; r <= rounds; r++) {
    const count = size / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      matches.push({ round: r, bracketPos: i + 1, bracket: "winners", p1: null, p2: null });
    }
  }
  return matches;
}

/* --- double elimination: winners bracket + losers bracket + grand final ---
   Losers bracket uses the standard alternating structure. */
export function doubleElim(seededPlayers: string[]): PairMatch[] {
  const wb = singleElim(seededPlayers);
  if (wb.length === 0) return [];
  const size = (wb.filter((m) => m.round === 1).length ?? 0) * 2;
  const wbRounds = Math.log2(size);
  const matches: PairMatch[] = [...wb];

  /* losers bracket rounds: 2*(wbRounds-1); round sizes alternate */
  let lbRound = 1;
  for (let r = 1; r < wbRounds; r++) {
    const dropCount = size / Math.pow(2, r + 1); // losers arriving from WB round r+? sizing
    /* consolidation round (existing LB survivors) then drop-in round */
    for (const phase of [0, 1]) {
      const count = dropCount;
      if (count < 1) break;
      for (let i = 0; i < count; i++) {
        matches.push({
          round: lbRound,
          bracketPos: i + 1,
          bracket: "losers",
          p1: null,
          p2: null,
        });
      }
      lbRound++;
      if (r === 1 && phase === 0) break; // LB round 1 is a single phase (WB R1 losers pair up)
    }
  }
  matches.push({ round: 1, bracketPos: 1, bracket: "grand_final", p1: null, p2: null });
  return matches;
}

/* --- swiss pairing for one round: sort by points, pair adjacent, avoid rematches --- */
export function swissPair(
  standings: Array<{ id: string; points: number }>,
  history: Array<[string, string]>,
  round: number,
): PairMatch[] {
  const played = new Set(history.map(([a, b]) => [a, b].sort().join("|")));
  const sorted = [...standings].sort((a, b) => b.points - a.points);
  const ids = sorted.map((s) => s.id);
  const used = new Set<string>();
  const matches: PairMatch[] = [];
  let pos = 1;

  for (let i = 0; i < ids.length; i++) {
    if (used.has(ids[i])) continue;
    let paired = false;
    for (let j = i + 1; j < ids.length; j++) {
      if (used.has(ids[j])) continue;
      const key = [ids[i], ids[j]].sort().join("|");
      if (!played.has(key)) {
        matches.push({ round, bracketPos: pos++, bracket: "winners", p1: ids[i], p2: ids[j] });
        used.add(ids[i]);
        used.add(ids[j]);
        paired = true;
        break;
      }
    }
    if (!paired && !used.has(ids[i])) {
      /* forced rematch fallback: pair with next available */
      for (let j = i + 1; j < ids.length; j++) {
        if (!used.has(ids[j])) {
          matches.push({ round, bracketPos: pos++, bracket: "winners", p1: ids[i], p2: ids[j] });
          used.add(ids[i]);
          used.add(ids[j]);
          paired = true;
          break;
        }
      }
    }
    if (!paired) {
      /* bye */
      matches.push({ round, bracketPos: pos++, bracket: "winners", p1: ids[i], p2: null });
      used.add(ids[i]);
    }
  }
  return matches;
}

/* Beyblade X finish points */
export const FINISH_POINTS: Record<string, number> = {
  xtreme: 3,
  burst: 2,
  over: 2,
  spin: 1,
};
