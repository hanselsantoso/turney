import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

type Session = { accessToken: string; user: { id: string; playerCode: string } };
const bearer = (s: Session) => ({ authorization: `Bearer ${s.accessToken}` });

async function mk(app: ReturnType<typeof buildApp>, name: string): Promise<Session> {
  return (
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: `${name.toLowerCase()}@turney.id`,
        password: "long-enough-password",
        displayName: name,
      },
    })
  ).json();
}

async function setupSingleElim(app: ReturnType<typeof buildApp>, playerCount: number) {
  const leader = await mk(app, "Leader");
  const judge = await mk(app, "Judgey");
  const community = (
    await app.inject({
      method: "POST",
      url: "/communities",
      headers: bearer(leader),
      payload: { name: "Match Comm" },
    })
  ).json();
  const tournament = (
    await app.inject({
      method: "POST",
      url: "/tournaments",
      headers: bearer(leader),
      payload: {
        communityId: community.id,
        name: "Match Cup",
        maxParticipants: playerCount,
        entryFee: 0,
        startsAt: new Date().toISOString(),
        stages: [{ name: "SE", format: "single_elim", scoring: "win_loss" }],
      },
    })
  ).json();
  await app.inject({
    method: "POST",
    url: `/tournaments/${tournament.id}/staff`,
    headers: bearer(leader),
    payload: { userId: judge.user.id, role: "judge" },
  });
  await app.inject({
    method: "POST",
    url: `/tournaments/${tournament.id}/status`,
    headers: bearer(leader),
    payload: { to: "reg_open" },
  });
  const players: Session[] = [];
  for (let i = 1; i <= playerCount; i++) players.push(await mk(app, `Player${i}`));
  for (const p of players) {
    await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/registrations`,
      headers: bearer(p),
    });
  }
  await app.inject({
    method: "POST",
    url: `/tournaments/${tournament.id}/status`,
    headers: bearer(leader),
    payload: { to: "reg_closed" },
  });
  await app.inject({
    method: "POST",
    url: `/tournaments/${tournament.id}/status`,
    headers: bearer(leader),
    payload: { to: "in_progress" },
  });
  return { leader, judge, tournament, stage: tournament.stages[0], players };
}

describe("match generation + scoring + finalize", () => {
  beforeEach(truncateAll);

  it("generates single elim, judge scores battles, finalize advances + ELO", async () => {
    const app = buildApp();
    const { leader, judge, stage } = await setupSingleElim(app, 4);

    const gen = await app.inject({
      method: "POST",
      url: `/stages/${stage.id}/generate`,
      headers: bearer(leader),
    });
    expect(gen.statusCode).toBe(201);
    const ms = gen.json() as Array<{
      id: string;
      round: number;
      p1RegId: string | null;
      p2RegId: string | null;
    }>;
    expect(ms).toHaveLength(3); // 4p SE: 2 + 1

    const r1 = ms.filter((m) => m.round === 1);
    const m0 = r1[0];

    /* premature finalize */
    const early = await app.inject({
      method: "POST",
      url: `/matches/${m0.id}/finalize`,
      headers: bearer(judge),
    });
    expect(early.statusCode).toBe(409);
    expect(early.json().code).toBe("NO_WINNER_YET");

    /* score to 4 points for p1 */
    for (const finish of ["xtreme", "spin"]) {
      const b = await app.inject({
        method: "POST",
        url: `/matches/${m0.id}/battles`,
        headers: bearer(judge),
        payload: { winnerRegId: m0.p1RegId, finishType: finish },
      });
      expect(b.statusCode).toBe(201);
    }
    /* one for p2 to prove tally works */
    await app.inject({
      method: "POST",
      url: `/matches/${m0.id}/battles`,
      headers: bearer(judge),
      payload: { winnerRegId: m0.p2RegId, finishType: "burst" },
    });

    const fin = await app.inject({
      method: "POST",
      url: `/matches/${m0.id}/finalize`,
      headers: bearer(judge),
    });
    expect(fin.statusCode).toBe(200);
    const result = fin.json();
    expect(result.match.winnerRegId).toBe(m0.p1RegId);
    expect(result.elo.winner.delta).toBeGreaterThan(0);

    /* winner advanced into round 2 slot */
    const after = (
      await app.inject({ method: "GET", url: `/stages/${stage.id}/matches` })
    ).json() as Array<{ round: number; p1RegId: string | null }>;
    const final = after.find((m) => m.round === 2)!;
    expect(final.p1RegId).toBe(m0.p1RegId);

    /* double finalize blocked */
    const again = await app.inject({
      method: "POST",
      url: `/matches/${m0.id}/finalize`,
      headers: bearer(judge),
    });
    expect(again.statusCode).toBe(409);
  });

  it("judge cannot score own match; players cannot score at all", async () => {
    const app = buildApp();
    const { leader, judge, tournament, stage, players } = await setupSingleElim(app, 4);

    /* judge also registers as a player (allowed while reg was open? reg closed now).
       Instead: grant judge role to one of the players — dual-role case. */
    await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/staff`,
      headers: bearer(leader),
      payload: { userId: players[0].user.id, role: "judge" },
    });

    await app.inject({
      method: "POST",
      url: `/stages/${stage.id}/generate`,
      headers: bearer(leader),
    });
    const ms = (
      await app.inject({ method: "GET", url: `/stages/${stage.id}/matches` })
    ).json() as Array<{ id: string; round: number; p1RegId: string; p2RegId: string }>;
    const r1 = ms.filter((m) => m.round === 1);

    /* find the match containing players[0]'s registration */
    const regs = (
      await app.inject({ method: "GET", url: `/tournaments/${tournament.id}/registrations` })
    ).json() as Array<{ id: string; userId: string }>;
    const ownReg = regs.find((r) => r.userId === players[0].user.id)!;
    const ownMatch = r1.find((m) => m.p1RegId === ownReg.id || m.p2RegId === ownReg.id)!;
    const otherMatch = r1.find((m) => m.id !== ownMatch.id)!;

    /* player-judge blocked on own match */
    const own = await app.inject({
      method: "POST",
      url: `/matches/${ownMatch.id}/battles`,
      headers: bearer(players[0]),
      payload: { winnerRegId: ownMatch.p1RegId, finishType: "spin" },
    });
    expect(own.statusCode).toBe(403);
    expect(own.json().code).toBe("OWN_MATCH");

    /* but allowed on the other match */
    const other = await app.inject({
      method: "POST",
      url: `/matches/${otherMatch.id}/battles`,
      headers: bearer(players[0]),
      payload: { winnerRegId: otherMatch.p1RegId, finishType: "spin" },
    });
    expect(other.statusCode).toBe(201);

    /* plain player (no judge grant) blocked everywhere */
    const plain = await app.inject({
      method: "POST",
      url: `/matches/${otherMatch.id}/battles`,
      headers: bearer(players[1]),
      payload: { winnerRegId: otherMatch.p1RegId, finishType: "spin" },
    });
    expect(plain.statusCode).toBe(403);
  });

  it("round robin generation pairs everyone exactly once", async () => {
    const app = buildApp();
    const leader = await mk(app, "RRLeader");
    const community = (
      await app.inject({
        method: "POST",
        url: "/communities",
        headers: bearer(leader),
        payload: { name: "RR Comm" },
      })
    ).json();
    const tournament = (
      await app.inject({
        method: "POST",
        url: "/tournaments",
        headers: bearer(leader),
        payload: {
          communityId: community.id,
          name: "RR Cup",
          maxParticipants: 5,
          entryFee: 0,
          startsAt: new Date().toISOString(),
          stages: [{ name: "RR", format: "round_robin", scoring: "points_accum" }],
        },
      })
    ).json();
    await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(leader),
      payload: { to: "reg_open" },
    });
    for (let i = 1; i <= 5; i++) {
      const p = await mk(app, `RR${i}`);
      await app.inject({
        method: "POST",
        url: `/tournaments/${tournament.id}/registrations`,
        headers: bearer(p),
      });
    }
    const gen = await app.inject({
      method: "POST",
      url: `/stages/${tournament.stages[0].id}/generate`,
      headers: bearer(leader),
    });
    expect(gen.statusCode).toBe(201);
    expect(gen.json()).toHaveLength(10); // C(5,2)
  });
});
