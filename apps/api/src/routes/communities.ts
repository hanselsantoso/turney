import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { createCommunityBody } from "@turney/shared";
import { db } from "../db/client";
import { communities, communityMembers } from "../db/schema";
import { requireAuth } from "../lib/guards";
import { slugify } from "../lib/slug";

export async function communityRoutes(app: FastifyInstance) {
  app.post("/communities", { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = createCommunityBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ code: "VALIDATION", message: "Invalid body", details: parsed.error.flatten() });
    }
    const leaderId = req.auth!.sub;
    const [community] = await db
      .insert(communities)
      .values({ ...parsed.data, leaderId, slug: slugify(parsed.data.name) })
      .returning();
    await db
      .insert(communityMembers)
      .values({ communityId: community.id, userId: leaderId })
      .onConflictDoNothing();
    return reply.status(201).send(community);
  });

  app.get("/communities", async (req) => {
    const { region, city } = req.query as { region?: string; city?: string };
    if (city) return db.select().from(communities).where(eq(communities.city, city));
    if (region) return db.select().from(communities).where(eq(communities.region, region));
    return db.select().from(communities);
  });

  app.post("/communities/:id/join", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [community] = await db.select().from(communities).where(eq(communities.id, id));
    if (!community) return reply.status(404).send({ code: "NOT_FOUND", message: "No community" });
    await db
      .insert(communityMembers)
      .values({ communityId: id, userId: req.auth!.sub })
      .onConflictDoNothing();
    return reply.status(204).send();
  });

  app.post("/communities/:id/leave", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db
      .delete(communityMembers)
      .where(
        and(eq(communityMembers.communityId, id), eq(communityMembers.userId, req.auth!.sub)),
      );
    return reply.status(204).send();
  });
}
