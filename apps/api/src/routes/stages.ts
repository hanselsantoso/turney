import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray } from "drizzle-orm";
import { swissPair } from "@turney/shared";
import { db } from "../db/client";
import {
  battles,
  matches,
  registrations,
  tournamentStages,
  users,
} from "../db/schema";
import { requireAuth } from "../lib/guards";
import { canManageTournament } from "../lib/capabilities";

export type StandingRow = {
  registrationId: string;
  displayName: string;
  elo: number;
  played: number;
  wins: number;
  losses: number;
  points: number; // battle points scored (points_accum) / match wins x3 fallback ordering
};

/* Standings from finalized matches + battle points. Works for every format:
   points_accum ranks by battle points, win_loss ranks by wins then points. */
export async function computeStandings(stageId: string): Promise<StandingRow[]> {
  const [stage] = await db.select().from(tournamentStages).where(eq(tournamentStages.id, stageId));
  if (!stage) return [];

  const ms = await db.select().from(matches).where(eq(matches.stageId, stageId));
  const regIds = [
    ...new Set(ms.flatMap((m) => [m.p1RegId, m.p2RegId]).filter((x): x is string => !!x)),
  ];
  if (regIds.length === 0) return [];

  const regs = await db
    .select({ registrationId: registrations.id, displayName: users.displayName, elo: users.elo })
    .from(registrations)
    .innerJoin(users, eq(registrations.userId, users.id))
    .where(inArray(registrations.id, regIds));

  const matchIds = ms.map((m) => m.id);
  const bs = matchIds.length
    ? await db.select().from(battles).where(inArray(battles.matchId, matchIds))
    : [];

  const rows = new Map<string, StandingRow>();
  for (const r of regs) {
    rows.set(r.registrationId, { ...r, played: 0, wins: 0, losses: 0, points: 0 });
  }
  for (const b of bs) {
    const row = rows.get(b.winnerRegId);
    if (row) row.points += b.points;
  }
  for (const m of ms) {
    if (m.status !== "done" || !m.winnerRegId) continue;
    for (const rid of [m.p1RegId, m.p2RegId]) {
      const row = rid ? rows.get(rid) : null;
      if (!row) continue;
      row.played++;
      if (rid === m.winnerRegId) row.wins++;
      else row.losses++;
    }
  }
  const list = [...rows.values()];
  if (stage.scoring === "points_accum") {
    list.sort((a, b) => b.points - a.points || b.wins - a.wins || b.elo - a.elo);
  } else {
    list.sort((a, b) => b.wins - a.wins || b.points - a.points || b.elo - a.elo);
  }
  return list;
}

export async function stageRoutes(app: FastifyInstance) {
  app.get("/stages/:stageId/standings", async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const [stage] = await db
      .select()
      .from(tournamentStages)
      .where(eq(tournamentStages.id, stageId));
    if (!stage) return reply.status(404).send({ code: "NOT_FOUND", message: "No stage" });
    return computeStandings(stageId);
  });

  /* Swiss: pair the next round from current standings, avoiding rematches. */
  app.post("/stages/:stageId/pair-next", { preHandler: [requireAuth] }, async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const [stage] = await db
      .select()
      .from(tournamentStages)
      .where(eq(tournamentStages.id, stageId));
    if (!stage) return reply.status(404).send({ code: "NOT_FOUND", message: "No stage" });
    if (stage.format !== "swiss")
      return reply.status(409).send({ code: "NOT_SWISS", message: "Only swiss pairs per round" });
    if (!(await canManageTournament(req.auth!.sub, stage.tournamentId)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });

    const ms = await db.select().from(matches).where(eq(matches.stageId, stageId));
    const open = ms.filter((m) => m.status !== "done");
    if (open.length > 0)
      return reply
        .status(409)
        .send({ code: "ROUND_OPEN", message: `${open.length} matches still unfinished` });

    const round = Math.max(0, ...ms.map((m) => m.round)) + 1;
    if (stage.roundsPlanned && round > stage.roundsPlanned)
      return reply
        .status(409)
        .send({ code: "ROUNDS_DONE", message: "Planned rounds complete; advance the stage" });

    const standings = await computeStandings(stageId);
    const history = ms
      .filter((m) => m.p1RegId && m.p2RegId)
      .map((m) => [m.p1RegId!, m.p2RegId!] as [string, string]);
    const pairs = swissPair(
      standings.map((s) => ({
        id: s.registrationId,
        points: stage.scoring === "points_accum" ? s.points : s.wins,
      })),
      history,
      round,
    );
    const rows = await db
      .insert(matches)
      .values(
        pairs.map((p) => ({
          stageId,
          round: p.round,
          bracketPos: p.bracketPos,
          bracket: p.bracket,
          p1RegId: p.p1,
          p2RegId: p.p2,
          /* bye auto-wins are finalized by the organizer via normal flow */
        })),
      )
      .returning();
    return reply.status(201).send(rows);
  });

  /* Close this stage, seed the next one from top-N standings.
     Last stage: closing it is the champion moment (tournament completed via
     the status endpoint). */
  app.post("/stages/:stageId/advance", { preHandler: [requireAuth] }, async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const [stage] = await db
      .select()
      .from(tournamentStages)
      .where(eq(tournamentStages.id, stageId));
    if (!stage) return reply.status(404).send({ code: "NOT_FOUND", message: "No stage" });
    if (!(await canManageTournament(req.auth!.sub, stage.tournamentId)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });
    if (stage.status === "done")
      return reply.status(409).send({ code: "STAGE_DONE", message: "Already advanced" });

    const ms = await db.select().from(matches).where(eq(matches.stageId, stageId));
    const open = ms.filter((m) => m.status !== "done" && m.p1RegId && m.p2RegId);
    if (ms.length === 0 || open.length > 0)
      return reply.status(409).send({
        code: "STAGE_OPEN",
        message: ms.length === 0 ? "Stage has no matches" : `${open.length} matches unfinished`,
      });

    const standings = await computeStandings(stageId);
    const [next] = await db
      .select()
      .from(tournamentStages)
      .where(
        and(
          eq(tournamentStages.tournamentId, stage.tournamentId),
          eq(tournamentStages.seq, stage.seq + 1),
        ),
      );

    await db
      .update(tournamentStages)
      .set({ status: "done" })
      .where(eq(tournamentStages.id, stageId));

    if (!next) {
      return {
        stage: "final",
        champion: standings[0] ?? null,
        standings: standings.slice(0, 3),
      };
    }

    const advancing = standings.slice(0, stage.advanceCount ?? standings.length);
    /* store seeds on registrations so /generate (ELO-seeded fallback) is
       overridden by stage seeding order */
    for (const [i, row] of advancing.entries()) {
      await db
        .update(registrations)
        .set({ seed: i + 1 })
        .where(eq(registrations.id, row.registrationId));
    }
    /* mark next stage active; its matches are generated from the advancers */
    await db
      .update(tournamentStages)
      .set({ status: "active" })
      .where(eq(tournamentStages.id, next.id));

    /* generate next stage matches directly from advancers (standings order) */
    const { roundRobin, singleElim, doubleElim } = await import("@turney/shared");
    const ids = advancing.map((a) => a.registrationId);
    let pairs;
    switch (next.format) {
      case "round_robin":
        pairs = roundRobin(ids);
        break;
      case "double_elim":
        pairs = doubleElim(ids);
        break;
      case "swiss":
        pairs = swissPair(ids.map((id) => ({ id, points: 0 })), [], 1);
        break;
      default:
        pairs = singleElim(ids);
    }
    const rows = await db
      .insert(matches)
      .values(
        pairs.map((p) => ({
          stageId: next.id,
          round: p.round,
          bracketPos: p.bracketPos,
          bracket: p.bracket,
          p1RegId: p.p1 === "__BYE__" ? null : p.p1,
          p2RegId: p.p2 === "__BYE__" ? null : p.p2,
        })),
      )
      .returning();

    app.io?.to(`tournament:${stage.tournamentId}`).emit("bracket:advanced", {
      fromStageId: stageId,
      toStageId: next.id,
    });
    return { stage: "advanced", nextStageId: next.id, advancers: advancing, matches: rows };
  });

  /* order matches consistently for clients */
  void asc;
}
