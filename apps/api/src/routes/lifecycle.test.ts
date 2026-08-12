import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

type Session = { accessToken: string; user: { id: string; playerCode: string } };

async function makeUser(app: ReturnType<typeof buildApp>, name: string): Promise<Session> {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: `${name.toLowerCase()}@turney.id`,
      password: "long-enough-password",
      displayName: name,
    },
  });
  return res.json();
}

const bearer = (s: Session) => ({ authorization: `Bearer ${s.accessToken}` });

describe("full tournament lifecycle", () => {
  beforeEach(truncateAll);

  it("community -> multi-stage tournament -> registrations -> check-in -> completed", async () => {
    const app = buildApp();
    const leader = await makeUser(app, "Sabaa");

    /* leader creates community */
    const cRes = await app.inject({
      method: "POST",
      url: "/communities",
      headers: bearer(leader),
      payload: { name: "Bandung Bladers", city: "Bandung", region: "Jawa Barat" },
    });
    expect(cRes.statusCode).toBe(201);
    const community = cRes.json();

    /* non-leader cannot create a tournament there */
    const rando = await makeUser(app, "Rando");
    const denied = await app.inject({
      method: "POST",
      url: "/tournaments",
      headers: bearer(rando),
      payload: {
        communityId: community.id,
        name: "Nope Cup",
        maxParticipants: 8,
        entryFee: 0,
        startsAt: new Date().toISOString(),
        stages: [{ name: "RR", format: "round_robin", scoring: "points_accum" }],
      },
    });
    expect(denied.statusCode).toBe(403);

    /* leader creates 3-stage tournament */
    const tRes = await app.inject({
      method: "POST",
      url: "/tournaments",
      headers: bearer(leader),
      payload: {
        communityId: community.id,
        name: "BB Cup #1",
        maxParticipants: 8,
        entryFee: 50000,
        prizePool: [{ place: 1, prize: "Rp 1.000.000" }],
        startsAt: new Date().toISOString(),
        stages: [
          { name: "Groups", format: "round_robin", scoring: "points_accum", advanceCount: 2 },
          { name: "Playoffs", format: "double_elim", scoring: "win_loss" },
          { name: "Final", format: "single_elim", scoring: "win_loss" },
        ],
      },
    });
    expect(tRes.statusCode).toBe(201);
    const tournament = tRes.json();
    expect(tournament.stages).toHaveLength(3);
    expect(tournament.status).toBe("draft");

    /* cannot register while draft */
    const early = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/registrations`,
      headers: bearer(rando),
    });
    expect(early.statusCode).toBe(409);

    /* illegal transition draft -> in_progress */
    const skip = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(leader),
      payload: { to: "in_progress" },
    });
    expect(skip.statusCode).toBe(409);
    expect(skip.json().currentStatus).toBe("draft");

    /* open registration */
    const open = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(leader),
      payload: { to: "reg_open" },
    });
    expect(open.statusCode).toBe(200);

    /* players register */
    const players: Session[] = [rando];
    for (const n of ["Gai", "Ekusu", "Bird", "Prince", "Kito", "Sena"]) {
      players.push(await makeUser(app, n));
    }
    for (const p of players) {
      const r = await app.inject({
        method: "POST",
        url: `/tournaments/${tournament.id}/registrations`,
        headers: bearer(p),
      });
      expect(r.statusCode).toBe(201);
    }

    /* duplicate registration blocked */
    const dupe = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/registrations`,
      headers: bearer(players[0]),
    });
    expect(dupe.statusCode).toBe(409);

    /* staff on-spot: leader adds 8th player by player code with cash */
    const walkin = await makeUser(app, "Renji");
    const onspot = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/onspot`,
      headers: bearer(leader),
      payload: { playerCode: walkin.user.playerCode, cashAmount: 50000 },
    });
    expect(onspot.statusCode).toBe(201);
    expect(onspot.json().payment.method).toBe("cash");
    expect(onspot.json().registration.status).toBe("paid");

    /* 9th player: full */
    const ninth = await makeUser(app, "Overflow");
    const full = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/registrations`,
      headers: bearer(ninth),
    });
    expect(full.statusCode).toBe(409);
    expect(full.json().code).toBe("FULL");

    /* close reg, enable check-in */
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
      payload: { to: "check_in" },
    });

    /* check-in via qr token */
    const regs = (
      await app.inject({ method: "GET", url: `/tournaments/${tournament.id}/registrations` })
    ).json() as Array<{ qrToken: string }>;
    const ci = await app.inject({
      method: "POST",
      url: "/registrations/check-in",
      headers: bearer(leader),
      payload: { qrToken: regs[0].qrToken },
    });
    expect(ci.statusCode).toBe(200);
    expect(ci.json().status).toBe("checked_in");

    /* start + complete */
    const start = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(leader),
      payload: { to: "in_progress" },
    });
    expect(start.statusCode).toBe(200);
    const done = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(leader),
      payload: { to: "completed" },
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().status).toBe("completed");
  });

  it("staff grant lets an organizer manage; judge grant does not", async () => {
    const app = buildApp();
    const leader = await makeUser(app, "Leader");
    const organizer = await makeUser(app, "Orga");
    const judge = await makeUser(app, "Judgey");

    const community = (
      await app.inject({
        method: "POST",
        url: "/communities",
        headers: bearer(leader),
        payload: { name: "Test Comm" },
      })
    ).json();
    const tournament = (
      await app.inject({
        method: "POST",
        url: "/tournaments",
        headers: bearer(leader),
        payload: {
          communityId: community.id,
          name: "Staff Cup",
          maxParticipants: 4,
          entryFee: 0,
          startsAt: new Date().toISOString(),
          stages: [{ name: "RR", format: "round_robin", scoring: "win_loss" }],
        },
      })
    ).json();

    await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/staff`,
      headers: bearer(leader),
      payload: { userId: organizer.user.id, role: "organizer" },
    });
    await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/staff`,
      headers: bearer(leader),
      payload: { userId: judge.user.id, role: "judge" },
    });

    const byOrganizer = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(organizer),
      payload: { to: "reg_open" },
    });
    expect(byOrganizer.statusCode).toBe(200);

    const byJudge = await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/status`,
      headers: bearer(judge),
      payload: { to: "reg_closed" },
    });
    expect(byJudge.statusCode).toBe(403);
  });
});
