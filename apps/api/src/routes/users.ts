import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { publicUser, updateMeBody } from "@turney/shared";
import { db } from "../db/client";
import { users } from "../db/schema";
import { requireAuth } from "../lib/guards";

function toPublic(u: typeof users.$inferSelect) {
  return publicUser.parse({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    isAdmin: u.isAdmin,
    playerCode: u.playerCode,
    elo: u.elo,
    city: u.city,
    region: u.region,
    onboardedAt: u.onboardedAt?.toISOString() ?? null,
  });
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", { preHandler: [requireAuth] }, async (req, reply) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.auth!.sub));
    if (!u) return reply.status(404).send({ code: "NOT_FOUND", message: "No user" });
    return toPublic(u);
  });

  app.patch("/users/me", { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = updateMeBody.safeParse(req.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ code: "VALIDATION", message: "Invalid body", details: parsed.error.flatten() });
    const { onboarded, ...fields } = parsed.data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;
    if (onboarded) patch.onboardedAt = new Date();
    const [u] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, req.auth!.sub))
      .returning();
    return toPublic(u);
  });
}
