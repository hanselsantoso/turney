import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  decks,
  deckSlots,
  deckVerifications,
  parts,
  registrations,
  tournamentStages,
} from "../db/schema";
import { requireAuth } from "../lib/guards";
import { canManageTournament } from "../lib/capabilities";
import { isJudgeOf } from "../lib/judge";

const slotInput = z.object({
  bladeId: z.string().uuid(),
  ratchetId: z.string().uuid(),
  bitId: z.string().uuid(),
  assistBladeId: z.string().uuid().nullish(),
});

const createDeckBody = z.object({
  name: z.string().min(1).max(60),
  slots: z.array(slotInput).length(3),
});

const verifyBody = z.object({
  status: z.enum(["approved", "rejected"]),
  notes: z.string().max(500).nullish(),
});

export async function deckRoutes(app: FastifyInstance) {
  app.get("/parts", async (req) => {
    const { kind } = req.query as { kind?: string };
    if (kind === "blade" || kind === "ratchet" || kind === "bit" || kind === "assist_blade") {
      return db.select().from(parts).where(eq(parts.kind, kind)).orderBy(asc(parts.name));
    }
    return db.select().from(parts).orderBy(asc(parts.kind), asc(parts.name));
  });

  app.post("/decks", { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = createDeckBody.safeParse(req.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ code: "VALIDATION", message: "Invalid body", details: parsed.error.flatten() });

    /* Beyblade X deck rule: the same blade cannot appear in two slots */
    const bladeIds = parsed.data.slots.map((s) => s.bladeId);
    if (new Set(bladeIds).size !== bladeIds.length) {
      return reply
        .status(422)
        .send({ code: "DUPLICATE_BLADE", message: "Same blade used in multiple slots" });
    }
    /* referenced parts must exist and be of the right kind */
    const allIds = parsed.data.slots.flatMap((s) =>
      [s.bladeId, s.ratchetId, s.bitId, s.assistBladeId].filter((x): x is string => Boolean(x)),
    );
    const found = await db.select().from(parts).where(inArray(parts.id, allIds));
    const byId = new Map(found.map((p) => [p.id, p]));
    for (const s of parsed.data.slots) {
      if (byId.get(s.bladeId)?.kind !== "blade")
        return reply.status(422).send({ code: "BAD_PART", message: "bladeId is not a blade" });
      if (byId.get(s.ratchetId)?.kind !== "ratchet")
        return reply.status(422).send({ code: "BAD_PART", message: "ratchetId is not a ratchet" });
      if (byId.get(s.bitId)?.kind !== "bit")
        return reply.status(422).send({ code: "BAD_PART", message: "bitId is not a bit" });
      if (s.assistBladeId && byId.get(s.assistBladeId)?.kind !== "assist_blade")
        return reply
          .status(422)
          .send({ code: "BAD_PART", message: "assistBladeId is not an assist blade" });
    }

    const [deck] = await db
      .insert(decks)
      .values({ userId: req.auth!.sub, name: parsed.data.name })
      .returning();
    await db
      .insert(deckSlots)
      .values(parsed.data.slots.map((s, i) => ({ deckId: deck.id, slot: i + 1, ...s })));
    const slots = await db.select().from(deckSlots).where(eq(deckSlots.deckId, deck.id));
    return reply.status(201).send({ ...deck, slots });
  });

  app.get("/decks", { preHandler: [requireAuth] }, async (req) => {
    const mine = await db.select().from(decks).where(eq(decks.userId, req.auth!.sub));
    const result = [];
    for (const d of mine) {
      const slots = await db
        .select()
        .from(deckSlots)
        .where(eq(deckSlots.deckId, d.id))
        .orderBy(asc(deckSlots.slot));
      result.push({ ...d, slots });
    }
    return result;
  });

  /* attach own deck to own registration */
  app.put("/registrations/:id/deck", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { deckId } = (req.body ?? {}) as { deckId?: string };
    if (!deckId) return reply.status(400).send({ code: "VALIDATION", message: "deckId required" });

    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id));
    if (!reg) return reply.status(404).send({ code: "NOT_FOUND", message: "No registration" });
    if (reg.userId !== req.auth!.sub)
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not your registration" });
    const [deck] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, req.auth!.sub)));
    if (!deck) return reply.status(404).send({ code: "NOT_FOUND", message: "No such deck" });

    const [updated] = await db
      .update(registrations)
      .set({ deckId })
      .where(eq(registrations.id, id))
      .returning();
    return updated;
  });

  /* judge verifies a registration's deck at the venue */
  app.post("/registrations/:id/verify-deck", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = verifyBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });

    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id));
    if (!reg) return reply.status(404).send({ code: "NOT_FOUND", message: "No registration" });
    if (reg.userId === req.auth!.sub)
      return reply.status(403).send({ code: "OWN_DECK", message: "Cannot verify your own deck" });

    const judge = await isJudgeOf(req.auth!.sub, reg.tournamentId);
    const manager = await canManageTournament(req.auth!.sub, reg.tournamentId);
    if (!judge && !manager)
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not judge or manager" });

    const [row] = await db
      .insert(deckVerifications)
      .values({
        registrationId: id,
        judgeId: req.auth!.sub,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    return reply.status(201).send(row);
  });

  /* QR resolve: judge scans token -> registration + player + deck + verification state */
  app.post("/qr/resolve", { preHandler: [requireAuth] }, async (req, reply) => {
    const { qrToken } = (req.body ?? {}) as { qrToken?: string };
    if (!qrToken)
      return reply.status(400).send({ code: "VALIDATION", message: "qrToken required" });
    const [reg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.qrToken, qrToken));
    if (!reg) return reply.status(404).send({ code: "NOT_FOUND", message: "Unknown QR" });

    let deck = null;
    if (reg.deckId) {
      const [d] = await db.select().from(decks).where(eq(decks.id, reg.deckId));
      if (d) {
        const slots = await db
          .select()
          .from(deckSlots)
          .where(eq(deckSlots.deckId, d.id))
          .orderBy(asc(deckSlots.slot));
        deck = { ...d, slots };
      }
    }
    const verifications = await db
      .select()
      .from(deckVerifications)
      .where(eq(deckVerifications.registrationId, reg.id));
    return { registration: reg, deck, verifications };
  });
}

/* referenced to satisfy noUnusedLocals in case stages import is trimmed later */
void tournamentStages;
