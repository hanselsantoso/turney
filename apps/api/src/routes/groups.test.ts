import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

type Session = { accessToken: string; user: { id: string } };
const bearer = (s: Session) => ({ authorization: `Bearer ${s.accessToken}` });

async function setup(app: ReturnType<typeof buildApp>) {
  const mk = async (name: string): Promise<Session> =>
    (
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

  const leader = await mk("Leader");
  const community = (
    await app.inject({
      method: "POST",
      url: "/communities",
      headers: bearer(leader),
      payload: { name: "Groups Comm" },
    })
  ).json();
  const tournament = (
    await app.inject({
      method: "POST",
      url: "/tournaments",
      headers: bearer(leader),
      payload: {
        communityId: community.id,
        name: "Groups Cup",
        maxParticipants: 8,
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
  const players: Session[] = [];
  for (const n of ["P1", "P2", "P3", "P4"]) players.push(await mk(n));
  const regs: Array<{ id: string }> = [];
  for (const p of players) {
    regs.push(
      (
        await app.inject({
          method: "POST",
          url: `/tournaments/${tournament.id}/registrations`,
          headers: bearer(p),
        })
      ).json(),
    );
  }
  return { leader, tournament, stage: tournament.stages[0], regs };
}

describe("stadiums + groups + moves", () => {
  beforeEach(truncateAll);

  it("creates arenas, groups, assigns and moves players with audit", async () => {
    const app = buildApp();
    const { leader, tournament, stage, regs } = await setup(app);

    const arena = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/stadiums`,
      headers: bearer(leader),
      payload: { name: "Arena 1" },
    });
    expect(arena.statusCode).toBe(201);

    const gA = (
      await app.inject({
        method: "POST",
        url: `/stages/${stage.id}/groups`,
        headers: bearer(leader),
        payload: { name: "Group A", advanceCount: 2 },
      })
    ).json();
    const gB = (
      await app.inject({
        method: "POST",
        url: `/stages/${stage.id}/groups`,
        headers: bearer(leader),
        payload: { name: "Group B", advanceCount: 2 },
      })
    ).json();

    for (const [i, r] of regs.entries()) {
      const g = i < 2 ? gA : gB;
      const res = await app.inject({
        method: "POST",
        url: `/groups/${g.id}/members`,
        headers: bearer(leader),
        payload: { registrationId: r.id },
      });
      expect(res.statusCode).toBe(201);
    }

    /* move P1 from A to B, audited */
    const move = await app.inject({
      method: "POST",
      url: `/stages/${stage.id}/move`,
      headers: bearer(leader),
      payload: { registrationId: regs[0].id, toGroupId: gB.id, reason: "walkout re-pair" },
    });
    expect(move.statusCode).toBe(201);
    expect(move.json().groupIdFrom).toBe(gA.id);
    expect(move.json().reason).toBe("walkout re-pair");

    const listed = (
      await app.inject({ method: "GET", url: `/stages/${stage.id}/groups` })
    ).json() as Array<{ id: string; members: Array<{ registrationId: string }> }>;
    const a = listed.find((g) => g.id === gA.id)!;
    const b = listed.find((g) => g.id === gB.id)!;
    expect(a.members).toHaveLength(1);
    expect(b.members).toHaveLength(3);

    const moves = (
      await app.inject({ method: "GET", url: `/stages/${stage.id}/moves` })
    ).json() as unknown[];
    expect(moves).toHaveLength(1);
  });

  it("rejects moves to a group in another stage and from non-managers", async () => {
    const app = buildApp();
    const { leader, tournament, stage, regs } = await setup(app);
    const outsider = (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "outsider@turney.id",
          password: "long-enough-password",
          displayName: "Outsider",
        },
      })
    ).json() as Session;

    const g = (
      await app.inject({
        method: "POST",
        url: `/stages/${stage.id}/groups`,
        headers: bearer(leader),
        payload: { name: "Group A" },
      })
    ).json();

    const denied = await app.inject({
      method: "POST",
      url: `/stages/${stage.id}/move`,
      headers: bearer(outsider),
      payload: { registrationId: regs[0].id, toGroupId: g.id },
    });
    expect(denied.statusCode).toBe(403);
  });
});
