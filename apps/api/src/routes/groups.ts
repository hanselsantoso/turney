import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { movePlayerBody } from "@turney/shared";
import { db } from "../db/client";
import {
  groupMembers,
  groupMoves,
  groups,
  registrations,
  stadiums,
  tournamentStages,
} from "../db/schema";
import { requireAuth } from "../lib/guards";
import { canManageTournament } from "../lib/capabilities";

const createGroupBody = z.object({
  name: z.string().min(1).max(40),
  managerId: z.string().uuid().nullish(),
  advanceCount: z.number().int().min(1).nullish(),
});

const createStadiumBody = z.object({
  name: z.string().min(1).max(40),
  judgeId: z.string().uuid().nullish(),
});

async function stageTournamentId(stageId: string) {
  const [stage] = await db
    .select({ tournamentId: tournamentStages.tournamentId })
    .from(tournamentStages)
    .where(eq(tournamentStages.id, stageId));
  return stage?.tournamentId ?? null;
}

export async function groupRoutes(app: FastifyInstance) {
  /* --- stadiums (shown as "Arena" in UI) --- */
  app.post("/tournaments/:id/stadiums", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = createStadiumBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    if (!(await canManageTournament(req.auth!.sub, id)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    const [row] = await db
      .insert(stadiums)
      .values({ tournamentId: id, ...parsed.data })
      .returning();
    return reply.status(201).send(row);
  });

  app.get("/tournaments/:id/stadiums", async (req) => {
    const { id } = req.params as { id: string };
    return db.select().from(stadiums).where(eq(stadiums.tournamentId, id));
  });

  /* --- groups per stage --- */
  app.post("/stages/:stageId/groups", { preHandler: [requireAuth] }, async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const parsed = createGroupBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    const tournamentId = await stageTournamentId(stageId);
    if (!tournamentId) return reply.status(404).send({ code: "NOT_FOUND", message: "No stage" });
    if (!(await canManageTournament(req.auth!.sub, tournamentId)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    const [row] = await db.insert(groups).values({ stageId, ...parsed.data }).returning();
    return reply.status(201).send(row);
  });

  app.get("/stages/:stageId/groups", async (req) => {
    const { stageId } = req.params as { stageId: string };
    const gs = await db.select().from(groups).where(eq(groups.stageId, stageId));
    const result = [];
    for (const g of gs) {
      const members = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, g.id));
      result.push({ ...g, members });
    }
    return result;
  });

  app.post("/groups/:groupId/members", { preHandler: [requireAuth] }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { registrationId } = (req.body ?? {}) as { registrationId?: string };
    if (!registrationId)
      return reply.status(400).send({ code: "VALIDATION", message: "registrationId required" });
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
    if (!group) return reply.status(404).send({ code: "NOT_FOUND", message: "No group" });
    const tournamentId = await stageTournamentId(group.stageId);
    if (!tournamentId || !(await canManageTournament(req.auth!.sub, tournamentId)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    await db.insert(groupMembers).values({ groupId, registrationId }).onConflictDoNothing();
    return reply.status(201).send({ groupId, registrationId });
  });

  /* Move player between groups, any time, audited. */
  app.post("/stages/:stageId/move", { preHandler: [requireAuth] }, async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const parsed = movePlayerBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    const tournamentId = await stageTournamentId(stageId);
    if (!tournamentId) return reply.status(404).send({ code: "NOT_FOUND", message: "No stage" });
    if (!(await canManageTournament(req.auth!.sub, tournamentId)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });

    const { registrationId, toGroupId, reason } = parsed.data;
    const [reg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, registrationId));
    if (!reg) return reply.status(404).send({ code: "NOT_FOUND", message: "No registration" });
    const [target] = await db.select().from(groups).where(eq(groups.id, toGroupId));
    if (!target || target.stageId !== stageId)
      return reply.status(400).send({ code: "BAD_GROUP", message: "Target group not in stage" });

    /* find current group in this stage, if any */
    const stageGroups = await db.select().from(groups).where(eq(groups.stageId, stageId));
    let fromGroupId: string | null = null;
    for (const g of stageGroups) {
      const [m] = await db
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.registrationId, registrationId)));
      if (m) {
        fromGroupId = g.id;
        break;
      }
    }
    if (fromGroupId) {
      await db
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, fromGroupId),
            eq(groupMembers.registrationId, registrationId),
          ),
        );
    }
    await db
      .insert(groupMembers)
      .values({ groupId: toGroupId, registrationId })
      .onConflictDoNothing();
    const [move] = await db
      .insert(groupMoves)
      .values({
        groupIdFrom: fromGroupId,
        groupIdTo: toGroupId,
        registrationId,
        movedBy: req.auth!.sub,
        reason: reason ?? null,
      })
      .returning();
    return reply.status(201).send(move);
  });

  app.get("/stages/:stageId/moves", async (req) => {
    const { stageId } = req.params as { stageId: string };
    const stageGroups = await db.select().from(groups).where(eq(groups.stageId, stageId));
    const ids = stageGroups.map((g) => g.id);
    if (ids.length === 0) return [];
    const all = await db.select().from(groupMoves);
    return all.filter((m) => ids.includes(m.groupIdTo));
  });
}
