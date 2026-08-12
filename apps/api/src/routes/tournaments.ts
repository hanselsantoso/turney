import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import {
  canTransition,
  createTournamentBody,
  grantStaffBody,
  statusBody,
  type TournamentStatus,
} from "@turney/shared";
import { db } from "../db/client";
import { tournaments, tournamentStages, tournamentStaff } from "../db/schema";
import { requireAuth } from "../lib/guards";
import { canCreateTournamentIn, canManageTournament } from "../lib/capabilities";
import { slugify } from "../lib/slug";

export async function tournamentRoutes(app: FastifyInstance) {
  app.post("/tournaments", { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = createTournamentBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ code: "VALIDATION", message: "Invalid body", details: parsed.error.flatten() });
    }
    const userId = req.auth!.sub;
    if (!(await canCreateTournamentIn(userId, parsed.data.communityId))) {
      return reply
        .status(403)
        .send({ code: "FORBIDDEN", message: "Only the community leader or an admin" });
    }
    const { stages, startsAt, ...rest } = parsed.data;
    const [tournament] = await db
      .insert(tournaments)
      .values({
        ...rest,
        startsAt: new Date(startsAt),
        slug: slugify(rest.name),
        createdBy: userId,
      })
      .returning();
    const stageRows = await db
      .insert(tournamentStages)
      .values(stages.map((s, i) => ({ ...s, tournamentId: tournament.id, seq: i + 1 })))
      .returning();
    return reply.status(201).send({ ...tournament, stages: stageRows });
  });

  app.get("/tournaments", async () => {
    return db.select().from(tournaments);
  });

  app.get("/tournaments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    if (!tournament) return reply.status(404).send({ code: "NOT_FOUND", message: "No tournament" });
    const stages = await db
      .select()
      .from(tournamentStages)
      .where(eq(tournamentStages.tournamentId, id))
      .orderBy(asc(tournamentStages.seq));
    return { ...tournament, stages };
  });

  app.post("/tournaments/:id/status", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });

    if (!(await canManageTournament(req.auth!.sub, id))) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    }
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    if (!tournament) return reply.status(404).send({ code: "NOT_FOUND", message: "No tournament" });

    const from = tournament.status as TournamentStatus;
    if (!canTransition(from, parsed.data.to)) {
      return reply.status(409).send({
        code: "ILLEGAL_TRANSITION",
        message: `Cannot go ${from} -> ${parsed.data.to}`,
        currentStatus: from,
      });
    }
    const [updated] = await db
      .update(tournaments)
      .set({ status: parsed.data.to })
      .where(eq(tournaments.id, id))
      .returning();
    return updated;
  });

  app.post("/tournaments/:id/staff", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = grantStaffBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    if (!(await canManageTournament(req.auth!.sub, id))) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    }
    const [row] = await db
      .insert(tournamentStaff)
      .values({ tournamentId: id, ...parsed.data, grantedBy: req.auth!.sub })
      .onConflictDoNothing()
      .returning();
    return reply.status(201).send(row ?? { code: "ALREADY_GRANTED" });
  });

  app.get("/tournaments/:id/staff", async (req) => {
    const { id } = req.params as { id: string };
    return db.select().from(tournamentStaff).where(eq(tournamentStaff.tournamentId, id));
  });
}
