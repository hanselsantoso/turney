import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";
import { midtransSignature } from "./payments";

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

async function paidSetup(app: ReturnType<typeof buildApp>) {
  const leader = await mk(app, "Leader");
  const gai = await mk(app, "Gai");
  const community = (
    await app.inject({
      method: "POST",
      url: "/communities",
      headers: bearer(leader),
      payload: { name: "Pay Comm" },
    })
  ).json();
  const tournament = (
    await app.inject({
      method: "POST",
      url: "/tournaments",
      headers: bearer(leader),
      payload: {
        communityId: community.id,
        name: "Pay Cup",
        maxParticipants: 8,
        entryFee: 50000,
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
  const reg = (
    await app.inject({
      method: "POST",
      url: `/tournaments/${tournament.id}/registrations`,
      headers: bearer(gai),
    })
  ).json();
  return { leader, gai, tournament, reg };
}

describe("midtrans payments", () => {
  beforeEach(truncateAll);

  it("creates pending payment + snap token, webhook settles it", async () => {
    const app = buildApp();
    const { leader, gai, tournament, reg } = await paidSetup(app);

    const created = await app.inject({
      method: "POST",
      url: "/payments/create",
      headers: bearer(gai),
      payload: { registrationId: reg.id },
    });
    expect(created.statusCode).toBe(201);
    const { orderId, snapToken, payment } = created.json();
    expect(snapToken).toContain("mock-snap-");
    expect(payment.status).toBe("pending");

    /* wrong signature rejected */
    const bad = await app.inject({
      method: "POST",
      url: "/payments/webhook",
      payload: {
        order_id: orderId,
        status_code: "200",
        gross_amount: "50000",
        transaction_status: "settlement",
        signature_key: "forged",
      },
    });
    expect(bad.statusCode).toBe(403);

    /* valid signature settles */
    const sig = midtransSignature(orderId, "200", "50000");
    const ok = await app.inject({
      method: "POST",
      url: "/payments/webhook",
      payload: {
        order_id: orderId,
        status_code: "200",
        gross_amount: "50000",
        transaction_status: "settlement",
        signature_key: sig,
      },
    });
    expect(ok.statusCode).toBe(200);

    /* registration flipped to paid */
    const regs = (
      await app.inject({ method: "GET", url: `/tournaments/${tournament.id}/registrations` })
    ).json() as Array<{ id: string; status: string }>;
    expect(regs.find((r) => r.id === reg.id)?.status).toBe("paid");

    /* webhook replay idempotent */
    const replay = await app.inject({
      method: "POST",
      url: "/payments/webhook",
      payload: {
        order_id: orderId,
        status_code: "200",
        gross_amount: "50000",
        transaction_status: "settlement",
        signature_key: sig,
      },
    });
    expect(replay.json().idempotent).toBe(true);

    /* second create blocked after paid */
    const again = await app.inject({
      method: "POST",
      url: "/payments/create",
      headers: bearer(gai),
      payload: { registrationId: reg.id },
    });
    expect(again.statusCode).toBe(409);

    /* manager sees payment in monitor; player is denied */
    const monitor = await app.inject({
      method: "GET",
      url: `/tournaments/${tournament.id}/payments`,
      headers: bearer(leader),
    });
    expect(monitor.statusCode).toBe(200);
    expect(monitor.json()).toHaveLength(1);
    const denied = await app.inject({
      method: "GET",
      url: `/tournaments/${tournament.id}/payments`,
      headers: bearer(gai),
    });
    expect(denied.statusCode).toBe(403);
  });

  it("cannot create payment for someone else's registration", async () => {
    const app = buildApp();
    const { leader, reg } = await paidSetup(app);
    const res = await app.inject({
      method: "POST",
      url: "/payments/create",
      headers: bearer(leader),
      payload: { registrationId: reg.id },
    });
    expect(res.statusCode).toBe(403);
  });
});
