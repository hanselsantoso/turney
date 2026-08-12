import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { payments, registrations, tournaments } from "../db/schema";
import { requireAuth } from "../lib/guards";
import { canManageTournament } from "../lib/capabilities";

/* Midtrans integration. Sandbox/production selected via env:
   MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION. Snap token request is a plain
   HTTPS call; in tests (no key) we mint a deterministic mock token. */

const SNAP_URL = () =>
  process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";

export function midtransSignature(orderId: string, statusCode: string, grossAmount: string) {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  return createHash("sha512").update(orderId + statusCode + grossAmount + key).digest("hex");
}

export async function paymentRoutes(app: FastifyInstance) {
  /* Create payment for own registration -> Snap token + order id */
  app.post("/payments/create", { preHandler: [requireAuth] }, async (req, reply) => {
    const { registrationId } = (req.body ?? {}) as { registrationId?: string };
    if (!registrationId)
      return reply.status(400).send({ code: "VALIDATION", message: "registrationId required" });

    const [reg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, registrationId));
    if (!reg) return reply.status(404).send({ code: "NOT_FOUND", message: "No registration" });
    if (reg.userId !== req.auth!.sub)
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not your registration" });
    if (reg.status === "paid" || reg.status === "checked_in")
      return reply.status(409).send({ code: "ALREADY_PAID", message: "Already paid" });

    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, reg.tournamentId));
    if (!t) return reply.status(404).send({ code: "NOT_FOUND", message: "No tournament" });
    if (t.entryFee <= 0)
      return reply.status(409).send({ code: "FREE_EVENT", message: "No fee for this tournament" });

    const orderId = `TRN-${reg.id.slice(0, 8)}-${Date.now().toString(36)}`;
    const [payment] = await db
      .insert(payments)
      .values({
        registrationId: reg.id,
        method: "midtrans",
        midtransOrderId: orderId,
        amount: t.entryFee,
        status: "pending",
      })
      .returning();

    let snapToken: string;
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (serverKey) {
      const res = await fetch(SNAP_URL(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${Buffer.from(serverKey + ":").toString("base64")}`,
        },
        body: JSON.stringify({
          transaction_details: { order_id: orderId, gross_amount: t.entryFee },
        }),
      });
      if (!res.ok) {
        return reply
          .status(502)
          .send({ code: "MIDTRANS_ERROR", message: `Snap request failed (${res.status})` });
      }
      snapToken = ((await res.json()) as { token: string }).token;
    } else {
      snapToken = `mock-snap-${orderId}`; // test/dev without keys
    }
    return reply.status(201).send({ payment, snapToken, orderId });
  });

  /* Midtrans notification webhook: signature-verified, idempotent */
  app.post("/payments/webhook", async (req, reply) => {
    const body = (req.body ?? {}) as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      transaction_status?: string;
      signature_key?: string;
    };
    const { order_id, status_code, gross_amount, transaction_status, signature_key } = body;
    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return reply.status(400).send({ code: "VALIDATION", message: "Missing fields" });
    }
    const expected = midtransSignature(order_id, status_code, gross_amount);
    if (signature_key !== expected) {
      return reply.status(403).send({ code: "BAD_SIGNATURE", message: "Signature mismatch" });
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.midtransOrderId, order_id));
    if (!payment) return reply.status(404).send({ code: "NOT_FOUND", message: "Unknown order" });
    if (payment.status === "settlement") return reply.send({ ok: true, idempotent: true });

    const map: Record<string, "settlement" | "expire" | "cancel" | "pending"> = {
      settlement: "settlement",
      capture: "settlement",
      expire: "expire",
      cancel: "cancel",
      deny: "cancel",
      pending: "pending",
    };
    const next = map[transaction_status ?? "pending"] ?? "pending";

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: next,
          rawWebhook: body,
          paidAt: next === "settlement" ? new Date() : null,
        })
        .where(eq(payments.id, payment.id));
      if (next === "settlement") {
        await tx
          .update(registrations)
          .set({ status: "paid" })
          .where(eq(registrations.id, payment.registrationId));
      }
    });
    return reply.send({ ok: true });
  });

  /* manager payment monitor per tournament */
  app.get("/tournaments/:id/payments", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await canManageTournament(req.auth!.sub, id)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    const regs = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.tournamentId, id));
    const ids = regs.map((r) => r.id);
    if (ids.length === 0) return [];
    const all = await db.select().from(payments).orderBy(desc(payments.createdAt));
    return all.filter((p) => ids.includes(p.registrationId));
  });
}
