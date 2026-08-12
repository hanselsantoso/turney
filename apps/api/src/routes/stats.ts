import type { FastifyInstance } from "fastify";
import { desc, eq, sql as dsql } from "drizzle-orm";
import { db } from "../db/client";
import { eloHistory, users } from "../db/schema";

export async function statsRoutes(app: FastifyInstance) {
  app.get("/leaderboard", async (req) => {
    const { limit } = req.query as { limit?: string };
    const n = Math.min(Number(limit) || 50, 200);
    return db
      .select({
        id: users.id,
        displayName: users.displayName,
        playerCode: users.playerCode,
        elo: users.elo,
        city: users.city,
      })
      .from(users)
      .orderBy(desc(users.elo))
      .limit(n);
  });

  app.get("/players/:id/stats", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [user] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        playerCode: users.playerCode,
        elo: users.elo,
        city: users.city,
        region: users.region,
      })
      .from(users)
      .where(eq(users.id, id));
    if (!user) return reply.status(404).send({ code: "NOT_FOUND", message: "No player" });

    const history = await db
      .select()
      .from(eloHistory)
      .where(eq(eloHistory.userId, id))
      .orderBy(desc(eloHistory.createdAt))
      .limit(100);

    const [agg] = await db
      .select({
        matches: dsql<number>`count(*)::int`,
        wins: dsql<number>`count(*) filter (where ${eloHistory.delta} > 0)::int`,
      })
      .from(eloHistory)
      .where(eq(eloHistory.userId, id));

    return {
      ...user,
      matches: agg?.matches ?? 0,
      wins: agg?.wins ?? 0,
      winRate: agg?.matches ? Math.round(((agg.wins ?? 0) / agg.matches) * 100) : 0,
      history,
    };
  });
}
