import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

type Session = { accessToken: string; user: { id: string } };
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

describe("standings + stage advancement", () => {
  beforeEach(truncateAll);

  it("RR standings by points, top-2 advance into a final, champion reported", async () => {
    const app = buildApp();
    const leader = await mk(app, "Leader");

    const community = (
      await app.inject({
        method: "POST",
        url: "/communities",
        headers: bearer(leader),
        payload: { name: "Adv Comm" },
      })
    ).json();
    const tournament = (
      await app.inject({
        method: "POST",
        url: "/tournaments",
        headers: bearer(leader),
        payload: {
          communityId: community.id,
          name: "Two Stage Cup",
          maxParticipants: 4,
          entryFee: 0,
          startsAt: new Date().toISOString(),
          stages: [
            { name: "Groups", format: "round_robin", scoring: "points_accum", advanceCount: 2 },
            { name: "Final", format: "single_elim", scoring: "win_loss" },
          ],
        },
      })
    ).json();
    const [rrStage, finalStage] = tournament.stages;

    await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(leader),
      payload: { to: "reg_open" },
    });
    const players: Record<string, Session> = {};
    const regByUser: Record<string, string> = {};
    for (const n of ["Alpha", "Beta", "Gamma", "Delta"]) {
      players[n] = await mk(app, n);
      const reg = (
        await app.inject({
          method: "POST",
          url: `/tournaments/${tournament.id}/registrations`,
          headers: bearer(players[n]),
        })
      ).json();
      regByUser[reg.userId] = reg.id;
    }
    const regOf = (n: string) => regByUser[players[n].user.id];

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
    await app.inject({
      method: "POST",
      url: `/stages/${rrStage.id}/generate`,
      headers: bearer(leader),
    });

    /* advance blocked while matches open */
    const early = await app.inject({
      method: "POST",
      url: `/stages/${rrStage.id}/advance`,
      headers: bearer(leader),
    });
    expect(early.statusCode).toBe(409);

    /* fixed outcome: Alpha wins all 4-0; Beta wins its other two 4-1;
       Gamma beats Delta 4-2. Ranking: Alpha 12, Beta 8(+1?), ... */
    const winPlan: Record<string, string[]> = {
      [regOf("Alpha")]: [regOf("Beta"), regOf("Gamma"), regOf("Delta")],
      [regOf("Beta")]: [regOf("Gamma"), regOf("Delta")],
      [regOf("Gamma")]: [regOf("Delta")],
    };
    const ms = (
      await app.inject({ method: "GET", url: `/stages/${rrStage.id}/matches` })
    ).json() as Array<{ id: string; p1RegId: string; p2RegId: string }>;
    expect(ms).toHaveLength(6);

    for (const m of ms) {
      const winner = winPlan[m.p1RegId]?.includes(m.p2RegId)
        ? m.p1RegId
        : winPlan[m.p2RegId]?.includes(m.p1RegId)
          ? m.p2RegId
          : m.p1RegId;
      const loser = winner === m.p1RegId ? m.p2RegId : m.p1RegId;
      /* winner 4 pts (xtreme+spin), loser 1 pt (spin) - loser point only sometimes */
      for (const [who, finish] of [
        [winner, "xtreme"],
        [loser, "spin"],
        [winner, "spin"],
      ] as const) {
        await app.inject({
          method: "POST",
          url: `/matches/${m.id}/battles`,
          headers: bearer(leader),
          payload: { winnerRegId: who, finishType: finish },
        });
      }
      const fin = await app.inject({
        method: "POST",
        url: `/matches/${m.id}/finalize`,
        headers: bearer(leader),
      });
      expect(fin.statusCode).toBe(200);
    }

    const standings = (
      await app.inject({ method: "GET", url: `/stages/${rrStage.id}/standings` })
    ).json() as Array<{ registrationId: string; points: number; wins: number }>;
    expect(standings[0].registrationId).toBe(regOf("Alpha"));
    expect(standings[0].wins).toBe(3);
    expect(standings[1].registrationId).toBe(regOf("Beta"));

    /* advance: closes RR, seeds + generates the final with top 2 */
    const adv = await app.inject({
      method: "POST",
      url: `/stages/${rrStage.id}/advance`,
      headers: bearer(leader),
    });
    expect(adv.statusCode).toBe(200);
    const body = adv.json();
    expect(body.stage).toBe("advanced");
    expect(body.advancers).toHaveLength(2);
    expect(body.matches).toHaveLength(1);
    const final = body.matches[0];
    expect([final.p1RegId, final.p2RegId].sort()).toEqual(
      [regOf("Alpha"), regOf("Beta")].sort(),
    );

    /* play the final: Beta upsets Alpha */
    for (const finish of ["xtreme", "spin"] as const) {
      await app.inject({
        method: "POST",
        url: `/matches/${final.id}/battles`,
        headers: bearer(leader),
        payload: { winnerRegId: regOf("Beta"), finishType: finish },
      });
    }
    await app.inject({
      method: "POST",
      url: `/matches/${final.id}/finalize`,
      headers: bearer(leader),
    });

    /* advancing the last stage reports the champion */
    const done = await app.inject({
      method: "POST",
      url: `/stages/${finalStage.id}/advance`,
      headers: bearer(leader),
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().stage).toBe("final");
    expect(done.json().champion.registrationId).toBe(regOf("Beta"));
  });
});
