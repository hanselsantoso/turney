import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";
import { db } from "../db/client";
import { parts } from "../db/schema";

type Session = { accessToken: string; user: { id: string } };
const bearer = (s: Session) => ({ authorization: `Bearer ${s.accessToken}` });

let blades: Array<{ id: string }>, ratchets: Array<{ id: string }>, bits: Array<{ id: string }>;

async function seedPartsOnce() {
  const { sql } = await import("../db/client");
  await sql`TRUNCATE TABLE deck_verifications, deck_slots, decks, parts CASCADE`;
  execSync("pnpm exec tsx src/db/seed-parts.ts", {
    cwd: new URL("../..", import.meta.url).pathname,
    env: { ...process.env },
    stdio: "ignore",
  });
  const seeded = await db.select().from(parts);
  if (seeded.length < 100) throw new Error(`parts seed incomplete: ${seeded.length}`);
}

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

describe("parts + decks + verification", () => {
  beforeAll(async () => {
    await truncateAll();
    await seedPartsOnce();
    const app = buildApp();
    blades = (await app.inject({ method: "GET", url: "/parts?kind=blade" })).json();
    ratchets = (await app.inject({ method: "GET", url: "/parts?kind=ratchet" })).json();
    bits = (await app.inject({ method: "GET", url: "/parts?kind=bit" })).json();
  });

  beforeEach(async () => {
    /* keep parts, wipe the rest */
    const { sql } = await import("../db/client");
    await sql`TRUNCATE TABLE
      deck_verifications, deck_slots, decks,
      group_moves, group_members, groups, stadiums, payments, registrations,
      tournament_staff, tournament_stages, tournaments,
      community_members, communities, users, elo_history, battles, matches
      CASCADE`;
  });

  it("catalog imported with real counts", () => {
    expect(blades.length).toBeGreaterThanOrEqual(80);
    expect(ratchets.length).toBeGreaterThanOrEqual(25); // source has duplicate names
    expect(bits.length).toBeGreaterThanOrEqual(40);
  });

  it("creates a 3-slot deck, rejects duplicate blade", async () => {
    const app = buildApp();
    const gai = await mk(app, "Gai");
    const mkSlot = (i: number) => ({
      bladeId: blades[i].id,
      ratchetId: ratchets[i].id,
      bitId: bits[i].id,
    });

    const ok = await app.inject({
      method: "POST",
      url: "/decks",
      headers: bearer(gai),
      payload: { name: "Storm Trio", slots: [mkSlot(0), mkSlot(1), mkSlot(2)] },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().slots).toHaveLength(3);

    const dupe = await app.inject({
      method: "POST",
      url: "/decks",
      headers: bearer(gai),
      payload: { name: "Bad Deck", slots: [mkSlot(0), mkSlot(0), mkSlot(2)] },
    });
    expect(dupe.statusCode).toBe(422);
    expect(dupe.json().code).toBe("DUPLICATE_BLADE");

    const wrongKind = await app.inject({
      method: "POST",
      url: "/decks",
      headers: bearer(gai),
      payload: {
        name: "Wrong Kind",
        slots: [
          mkSlot(0),
          mkSlot(1),
          { bladeId: bits[0].id, ratchetId: ratchets[2].id, bitId: bits[2].id },
        ],
      },
    });
    expect(wrongKind.statusCode).toBe(422);
  });

  it("attach deck to registration, QR resolve, judge verify (not own)", async () => {
    const app = buildApp();
    const leader = await mk(app, "Leader");
    const gai = await mk(app, "Gai");

    const community = (
      await app.inject({
        method: "POST",
        url: "/communities",
        headers: bearer(leader),
        payload: { name: "Deck Comm" },
      })
    ).json();
    const tournament = (
      await app.inject({
        method: "POST",
        url: "/tournaments",
        headers: bearer(leader),
        payload: {
          communityId: community.id,
          name: "Deck Cup",
          maxParticipants: 4,
          entryFee: 0,
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

    const deck = (
      await app.inject({
        method: "POST",
        url: "/decks",
        headers: bearer(gai),
        payload: {
          name: "Storm Trio",
          slots: [0, 1, 2].map((i) => ({
            bladeId: blades[i].id,
            ratchetId: ratchets[i].id,
            bitId: bits[i].id,
          })),
        },
      })
    ).json();

    /* someone else's deck attach blocked */
    const leaderDeckAttach = await app.inject({
      method: "PUT",
      url: `/registrations/${reg.id}/deck`,
      headers: bearer(leader),
      payload: { deckId: deck.id },
    });
    expect(leaderDeckAttach.statusCode).toBe(403);

    const attach = await app.inject({
      method: "PUT",
      url: `/registrations/${reg.id}/deck`,
      headers: bearer(gai),
      payload: { deckId: deck.id },
    });
    expect(attach.statusCode).toBe(200);

    const resolved = await app.inject({
      method: "POST",
      url: "/qr/resolve",
      headers: bearer(leader),
      payload: { qrToken: reg.qrToken },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().deck.slots).toHaveLength(3);

    /* self-verify blocked; leader (manager) verify ok */
    const self = await app.inject({
      method: "POST",
      url: `/registrations/${reg.id}/verify-deck`,
      headers: bearer(gai),
      payload: { status: "approved" },
    });
    expect(self.statusCode).toBe(403);

    const verify = await app.inject({
      method: "POST",
      url: `/registrations/${reg.id}/verify-deck`,
      headers: bearer(leader),
      payload: { status: "approved", notes: "all legal" },
    });
    expect(verify.statusCode).toBe(201);
    expect(verify.json().status).toBe("approved");
  });
});
