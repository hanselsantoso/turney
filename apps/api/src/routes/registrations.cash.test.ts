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

async function makeTournament(
  app: ReturnType<typeof buildApp>,
  leader: Session,
  entryFee: number,
) {
  const community = (
    await app.inject({
      method: "POST",
      url: "/communities",
      headers: bearer(leader),
      payload: { name: `Comm${entryFee}` },
    })
  ).json();
  const tournament = (
    await app.inject({
      method: "POST",
      url: "/tournaments",
      headers: bearer(leader),
      payload: {
        communityId: community.id,
        name: `Cup ${entryFee}`,
        maxParticipants: 8,
        entryFee,
        startsAt: new Date().toISOString(),
        stages: [{ name: "RR", format: "round_robin", scoring: "win_loss" }],
      },
    })
  ).json();
  await app.inject({
    method: "POST",
    url: `/tournaments/${tournament.id}/status`,
    headers: bearer(leader),
    payload: { to: "reg_open" },
  });
  return tournament;
}

describe("registration without payment gateway", () => {
  beforeEach(truncateAll);

  it("free tournament: registration confirms instantly", async () => {
    const app = buildApp();
    const leader = await mk(app, "Leader");
    const gai = await mk(app, "Gai");
    const t = await makeTournament(app, leader, 0);

    const reg = await app.inject({
      method: "POST",
      url: `/tournaments/${t.id}/registrations`,
      headers: bearer(gai),
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().status).toBe("paid");
  });

  it("paid tournament: pending until staff records cash", async () => {
    const app = buildApp();
    const leader = await mk(app, "Leader");
    const gai = await mk(app, "Gai");
    const t = await makeTournament(app, leader, 50000);

    const reg = (
      await app.inject({
        method: "POST",
        url: `/tournaments/${t.id}/registrations`,
        headers: bearer(gai),
      })
    ).json();
    expect(reg.status).toBe("pending");

    /* player cannot settle their own registration */
    const self = await app.inject({
      method: "POST",
      url: `/registrations/${reg.id}/record-cash`,
      headers: bearer(gai),
    });
    expect(self.statusCode).toBe(403);

    /* leader records cash: settles at entry fee by default */
    const cash = await app.inject({
      method: "POST",
      url: `/registrations/${reg.id}/record-cash`,
      headers: bearer(leader),
    });
    expect(cash.statusCode).toBe(201);
    expect(cash.json().registration.status).toBe("paid");
    expect(cash.json().payment.method).toBe("cash");
    expect(cash.json().payment.amount).toBe(50000);

    /* double record blocked */
    const again = await app.inject({
      method: "POST",
      url: `/registrations/${reg.id}/record-cash`,
      headers: bearer(leader),
    });
    expect(again.statusCode).toBe(409);
  });
});
