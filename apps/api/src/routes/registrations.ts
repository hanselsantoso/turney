import type { FastifyInstance } from "fastify";
import { and, count, eq } from "drizzle-orm";
import { onspotRegisterBody } from "@turney/shared";
import { db } from "../db/client";
import { payments, registrations, tournaments, users } from "../db/schema";
import { requireAuth } from "../lib/guards";
import { canManageTournament } from "../lib/capabilities";

type CapacityError = { status: number; code: string; message: string; currentStatus?: string };
type CapacityResult =
  | { ok: false; error: CapacityError }
  | { ok: true; tournament: typeof tournaments.$inferSelect };

async function withCapacity(tournamentId: string): Promise<CapacityResult> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) return { ok: false, error: { status: 404, code: "NOT_FOUND", message: "No tournament" } };
  if (t.status !== "reg_open") {
    return {
      ok: false,
      error: {
        status: 409,
        code: "REG_CLOSED",
        message: "Registration is not open",
        currentStatus: t.status,
      },
    };
  }
  const [{ value: current }] = await db
    .select({ value: count() })
    .from(registrations)
    .where(and(eq(registrations.tournamentId, tournamentId)));
  if (current >= t.maxParticipants) {
    return { ok: false, error: { status: 409, code: "FULL", message: "Tournament is full" } };
  }
  return { ok: true, tournament: t };
}

export async function registrationRoutes(app: FastifyInstance) {
  app.post(
    "/tournaments/:id/registrations",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const cap = await withCapacity(id);
      if (!cap.ok) return reply.status(cap.error.status).send(cap.error);

      const [row] = await db
        .insert(registrations)
        .values({ tournamentId: id, userId: req.auth!.sub })
        .onConflictDoNothing()
        .returning();
      if (!row) {
        return reply
          .status(409)
          .send({ code: "ALREADY_REGISTERED", message: "Already registered" });
      }
      return reply.status(201).send(row);
    },
  );

  /* Staff adds a player on the spot by player code; optional cash record. */
  app.post("/tournaments/:id/onspot", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = onspotRegisterBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    if (!(await canManageTournament(req.auth!.sub, id))) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    }
    const cap = await withCapacity(id);
    if (!cap.ok) return reply.status(cap.error.status).send(cap.error);

    const [player] = await db
      .select()
      .from(users)
      .where(eq(users.playerCode, parsed.data.playerCode));
    if (!player)
      return reply.status(404).send({ code: "PLAYER_NOT_FOUND", message: "Unknown player code" });

    const [row] = await db
      .insert(registrations)
      .values({
        tournamentId: id,
        userId: player.id,
        registeredBy: req.auth!.sub,
        status: parsed.data.cashAmount != null ? "paid" : "pending",
      })
      .onConflictDoNothing()
      .returning();
    if (!row)
      return reply.status(409).send({ code: "ALREADY_REGISTERED", message: "Already registered" });

    let payment = null;
    if (parsed.data.cashAmount != null) {
      [payment] = await db
        .insert(payments)
        .values({
          registrationId: row.id,
          method: "cash",
          amount: parsed.data.cashAmount,
          status: "settlement",
          recordedBy: req.auth!.sub,
          paidAt: new Date(),
        })
        .returning();
    }
    return reply.status(201).send({ registration: row, payment });
  });

  /* Check-in: player presents QR token; staff device posts it. */
  app.post("/registrations/check-in", { preHandler: [requireAuth] }, async (req, reply) => {
    const { qrToken } = (req.body ?? {}) as { qrToken?: string };
    if (!qrToken)
      return reply.status(400).send({ code: "VALIDATION", message: "qrToken required" });
    const [row] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.qrToken, qrToken));
    if (!row) return reply.status(404).send({ code: "NOT_FOUND", message: "Unknown QR" });

    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, row.tournamentId));
    if (!t || (t.status !== "check_in" && t.status !== "in_progress" && t.status !== "reg_closed")) {
      return reply.status(409).send({
        code: "CHECKIN_CLOSED",
        message: "Check-in not available",
        currentStatus: t?.status,
      });
    }
    const [updated] = await db
      .update(registrations)
      .set({ status: "checked_in" })
      .where(eq(registrations.id, row.id))
      .returning();
    return updated;
  });

  app.get("/tournaments/:id/registrations", async (req) => {
    const { id } = req.params as { id: string };
    return db.select().from(registrations).where(eq(registrations.tournamentId, id));
  });
}
