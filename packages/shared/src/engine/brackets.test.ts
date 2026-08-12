import { describe, it, expect } from "vitest";
import { roundRobin, singleElim, doubleElim, swissPair } from "./brackets";
import { applyElo, eloDelta } from "./elo";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("roundRobin", () => {
  for (const n of [2, 3, 4, 5, 7, 8, 16]) {
    it(`n=${n}: every pair exactly once`, () => {
      const ms = roundRobin(players(n));
      expect(ms).toHaveLength((n * (n - 1)) / 2);
      const seen = new Set<string>();
      for (const m of ms) {
        expect(m.p1).not.toBeNull();
        expect(m.p2).not.toBeNull();
        expect(m.p1).not.toBe(m.p2);
        const key = [m.p1, m.p2].sort().join("|");
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    });

    it(`n=${n}: no player twice in one round`, () => {
      const ms = roundRobin(players(n));
      const byRound = new Map<number, string[]>();
      for (const m of ms) {
        const arr = byRound.get(m.round) ?? [];
        arr.push(m.p1!, m.p2!);
        byRound.set(m.round, arr);
      }
      for (const [, arr] of byRound) {
        expect(new Set(arr).size).toBe(arr.length);
      }
    });
  }
});

describe("singleElim", () => {
  it("8 players: 7 matches, 3 rounds, seeds 1+2 opposite halves", () => {
    const ms = singleElim(players(8));
    expect(ms).toHaveLength(7);
    expect(Math.max(...ms.map((m) => m.round))).toBe(3);
    const r1 = ms.filter((m) => m.round === 1);
    /* seed 1 (p1) and seed 2 (p2) must not meet in round 1 */
    const p1Match = r1.find((m) => m.p1 === "p1" || m.p2 === "p1")!;
    expect([p1Match.p1, p1Match.p2]).not.toContain("p2");
    /* seed 1 plays seed 8 */
    expect([p1Match.p1, p1Match.p2].sort()).toEqual(["p1", "p8"]);
  });

  it("6 players: byes for top seeds, still valid structure", () => {
    const ms = singleElim(players(6));
    const r1 = ms.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    const byes = r1.filter((m) => m.p1 === null || m.p2 === null);
    expect(byes).toHaveLength(2);
    /* every real player appears exactly once in round 1 */
    const appear = r1.flatMap((m) => [m.p1, m.p2]).filter(Boolean);
    expect(new Set(appear).size).toBe(6);
  });

  it("any n from 2..33 produces a full slot tree", () => {
    for (let n = 2; n <= 33; n++) {
      const ms = singleElim(players(n));
      let size = 1;
      while (size < n) size *= 2;
      expect(ms).toHaveLength(size - 1);
    }
  });
});

describe("doubleElim", () => {
  it("8 players: has winners, losers, and grand final", () => {
    const ms = doubleElim(players(8));
    expect(ms.some((m) => m.bracket === "winners")).toBe(true);
    expect(ms.some((m) => m.bracket === "losers")).toBe(true);
    expect(ms.filter((m) => m.bracket === "grand_final")).toHaveLength(1);
    /* WB 7 matches for 8p */
    expect(ms.filter((m) => m.bracket === "winners")).toHaveLength(7);
  });
});

describe("swissPair", () => {
  it("pairs by points and avoids rematches", () => {
    const standings = [
      { id: "a", points: 6 },
      { id: "b", points: 6 },
      { id: "c", points: 3 },
      { id: "d", points: 3 },
    ];
    const history: Array<[string, string]> = [["a", "b"]];
    const ms = swissPair(standings, history, 3);
    expect(ms).toHaveLength(2);
    const ab = ms.find((m) => [m.p1, m.p2].sort().join() === "a,b");
    expect(ab).toBeUndefined(); // rematch avoided
  });

  it("odd count yields one bye", () => {
    const ms = swissPair(
      [
        { id: "a", points: 3 },
        { id: "b", points: 0 },
        { id: "c", points: 0 },
      ],
      [],
      2,
    );
    const bye = ms.filter((m) => m.p2 === null);
    expect(bye).toHaveLength(1);
  });
});

describe("elo", () => {
  it("equal ratings shift by 16", () => {
    expect(eloDelta(1000, 1000)).toBe(16);
  });
  it("upset pays more than expected win", () => {
    expect(eloDelta(1000, 1400)).toBeGreaterThan(eloDelta(1400, 1000));
  });
  it("applyElo is zero-sum", () => {
    const r = applyElo(1247, 1391);
    expect(r.winner.delta + r.loser.delta).toBe(0);
    expect(r.winner.after).toBeGreaterThan(1247);
    expect(r.loser.after).toBeLessThan(1391);
  });
});
