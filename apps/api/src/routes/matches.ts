import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  FINISH_POINTS,
  applyElo,
  doubleElim,
  roundRobin,
  singleElim,
  swissPair,
  type PairMatch,
} from "@turney/shared";

declare module "fastify" {
  interface FastifyInstance {
    /* wired by realtime plugin; minimal emit surface so tests run without sockets */
    io?: { to(room: string): { emit(event: string, data: unknown): void } };
  }
}
import { db } from "../db/client";
import {
  battles,
  eloHistory,
  matches,
  registrations,
  tournamentStages,
  users,
} from "../db/schema";
import { requireAuth } from "../lib/guards";
import { canManageTournament } from "../lib/capabilities";
import { isJudgeOf } from "../lib/judge";

const battleBody = z.object({
  winnerRegId: z.string().uuid(),
  finishType: z.enum(["xtreme", "burst", "over", "spin"]),
});

const WIN_THRESHOLD = 4;

export async function matchRoutes(app: FastifyInstance) {
  /* Generate matches for a stage from checked-in (or paid) registrations, ELO-seeded. */
  app.post("/stages/:stageId/generate", { preHandler: [requireAuth] }, async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const [stage] = await db
      .select()
      .from(tournamentStages)
      .where(eq(tournamentStages.id, stageId));
    if (!stage) return reply.status(404).send({ code: "NOT_FOUND", message: "No stage" });
    if (!(await canManageTournament(req.auth!.sub, stage.tournamentId)))
      return reply.status(403).send({ code: "FORBIDDEN", message: "Not a manager" });

    const existing = await db.select().from(matches).where(eq(matches.stageId, stageId));
    if (existing.length > 0)
      return reply.status(409).send({ code: "ALREADY_GENERATED", message: "Stage has matches" });

    /* seed by ELO desc */
    const regs = await db
      .select({ regId: registrations.id, elo: users.elo, status: registrations.status })
      .from(registrations)
      .innerJoin(users, eq(registrations.userId, users.id))
      .where(eq(registrations.tournamentId, stage.tournamentId));
    const active = regs
      .filter((r) => r.status !== "cancelled")
      .sort((a, b) => b.elo - a.elo)
      .map((r) => r.regId);
    if (active.length < 2)
      return reply.status(409).send({ code: "NOT_ENOUGH_PLAYERS", message: "Need 2+ players" });

    let pairs: PairMatch[];
    switch (stage.format) {
      case "round_robin":
        pairs = roundRobin(active);
        break;
      case "single_elim":
        pairs = singleElim(active);
        break;
      case "double_elim":
        pairs = doubleElim(active);
        break;
      case "swiss":
        /* swiss generates per-round; round 1 = adjacent ELO pairing */
        pairs = swissPair(active.map((id) => ({ id, points: 0 })), [], 1);
        break;
      default:
        pairs = [];
    }
    const rows = await db
      .insert(matches)
      .values(
        pairs.map((p) => ({
          stageId,
          round: p.round,
          bracketPos: p.bracketPos,
          bracket: p.bracket,
          p1RegId: p.p1 === "__BYE__" ? null : p.p1,
          p2RegId: p.p2 === "__BYE__" ? null : p.p2,
        })),
      )
      .returning();
    await db
      .update(tournamentStages)
      .set({ status: "active" })
      .where(eq(tournamentStages.id, stageId));
    return reply.status(201).send(rows);
  });

  app.get("/matches/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return reply.status(404).send({ code: "NOT_FOUND", message: "No match" });
    return match;
  });

  app.get("/stages/:stageId/matches", async (req) => {
    const { stageId } = req.params as { stageId: string };
    return db
      .select()
      .from(matches)
      .where(eq(matches.stageId, stageId))
      .orderBy(asc(matches.round), asc(matches.bracketPos));
  });

  /* Record one battle (judge or manager). Judge cannot score own match. */
  app.post("/matches/:id/battles", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = battleBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });

    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return reply.status(404).send({ code: "NOT_FOUND", message: "No match" });
    if (match.status === "done")
      return reply.status(409).send({ code: "MATCH_DONE", message: "Already finalized" });

    const gate = await scoringGate(req.auth!.sub, match);
    if (gate) return reply.status(gate.status).send(gate);

    if (parsed.data.winnerRegId !== match.p1RegId && parsed.data.winnerRegId !== match.p2RegId) {
      return reply
        .status(400)
        .send({ code: "BAD_WINNER", message: "Winner not in this match" });
    }
    const prior = await db.select().from(battles).where(eq(battles.matchId, id));
    const [row] = await db
      .insert(battles)
      .values({
        matchId: id,
        seq: prior.length + 1,
        winnerRegId: parsed.data.winnerRegId,
        finishType: parsed.data.finishType,
        points: FINISH_POINTS[parsed.data.finishType],
      })
      .returning();
    if (match.status === "pending" || match.status === "scheduled") {
      await db.update(matches).set({ status: "in_progress" }).where(eq(matches.id, id));
    }
    return reply.status(201).send(row);
  });

  app.get("/matches/:id/battles", async (req) => {
    const { id } = req.params as { id: string };
    return db.select().from(battles).where(eq(battles.matchId, id)).orderBy(asc(battles.seq));
  });

  /* Finalize: tally -> winner -> ELO -> advance winner into next-round slot. */
  app.post("/matches/:id/finalize", { preHandler: [requireAuth] }, async (req, reply) => {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, (req.params as { id: string }).id));
    if (!match) return reply.status(404).send({ code: "NOT_FOUND", message: "No match" });
    if (match.status === "done")
      return reply.status(409).send({ code: "MATCH_DONE", message: "Already finalized" });
    if (!match.p1RegId || !match.p2RegId)
      return reply.status(409).send({ code: "INCOMPLETE", message: "Match missing players" });

    const gate = await scoringGate(req.auth!.sub, match);
    if (gate) return reply.status(gate.status).send(gate);

    const [stageRow] = await db
      .select()
      .from(tournamentStages)
      .where(eq(tournamentStages.id, match.stageId));
    /* winner slot-advance is an elimination-bracket concept; round robin and
       swiss pairings are fixed/paired-per-round and must never be overwritten */
    const isElimination =
      stageRow?.format === "single_elim" || stageRow?.format === "double_elim";

    const rows = await db.select().from(battles).where(eq(battles.matchId, match.id));
    const score = new Map<string, number>();
    for (const b of rows) score.set(b.winnerRegId, (score.get(b.winnerRegId) ?? 0) + b.points);
    const s1 = score.get(match.p1RegId) ?? 0;
    const s2 = score.get(match.p2RegId) ?? 0;
    if (Math.max(s1, s2) < WIN_THRESHOLD || s1 === s2) {
      return reply.status(409).send({
        code: "NO_WINNER_YET",
        message: `Need ${WIN_THRESHOLD}+ points and a lead`,
        score: { p1: s1, p2: s2 },
      });
    }
    const winnerRegId = s1 > s2 ? match.p1RegId : match.p2RegId;
    const loserRegId = s1 > s2 ? match.p2RegId : match.p1RegId;

    const result = await db.transaction(async (tx) => {
      const [winReg] = await tx
        .select({ userId: registrations.userId })
        .from(registrations)
        .where(eq(registrations.id, winnerRegId));
      const [loseReg] = await tx
        .select({ userId: registrations.userId })
        .from(registrations)
        .where(eq(registrations.id, loserRegId));
      const [winUser] = await tx.select().from(users).where(eq(users.id, winReg.userId));
      const [loseUser] = await tx.select().from(users).where(eq(users.id, loseReg.userId));

      const elo = applyElo(winUser.elo, loseUser.elo);
      await tx.update(users).set({ elo: elo.winner.after }).where(eq(users.id, winUser.id));
      await tx.update(users).set({ elo: elo.loser.after }).where(eq(users.id, loseUser.id));
      await tx.insert(eloHistory).values([
        {
          userId: winUser.id,
          matchId: match.id,
          eloBefore: elo.winner.before,
          eloAfter: elo.winner.after,
          delta: elo.winner.delta,
        },
        {
          userId: loseUser.id,
          matchId: match.id,
          eloBefore: elo.loser.before,
          eloAfter: elo.loser.after,
          delta: elo.loser.delta,
        },
      ]);
      const [updated] = await tx
        .update(matches)
        .set({ status: "done", winnerRegId })
        .where(eq(matches.id, match.id))
        .returning();

      /* advance winner into next round slot (elimination brackets) */
      if (isElimination && match.bracket === "winners") {
        const nextPos = Math.ceil(match.bracketPos / 2);
        const [next] = await tx
          .select()
          .from(matches)
          .where(
            and(
              eq(matches.stageId, match.stageId),
              eq(matches.bracket, "winners"),
              eq(matches.round, match.round + 1),
              eq(matches.bracketPos, nextPos),
            ),
          );
        if (next) {
          const slot = match.bracketPos % 2 === 1 ? { p1RegId: winnerRegId } : { p2RegId: winnerRegId };
          await tx.update(matches).set(slot).where(eq(matches.id, next.id));
        }
      }
      return { match: updated, elo };
    });

    if (stageRow) {
      app.io
        ?.to(`tournament:${stageRow.tournamentId}`)
        .emit("match:updated", { matchId: match.id, stageId: match.stageId });
    }
    return result;
  });
}

async function scoringGate(
  userId: string,
  match: typeof matches.$inferSelect,
): Promise<{ status: number; code: string; message: string } | null> {
  const [stage] = await db
    .select()
    .from(tournamentStages)
    .where(eq(tournamentStages.id, match.stageId));
  if (!stage) return { status: 404, code: "NOT_FOUND", message: "No stage" };

  /* own-match guard applies to everyone, including managers */
  for (const regId of [match.p1RegId, match.p2RegId]) {
    if (!regId) continue;
    const [reg] = await db
      .select({ userId: registrations.userId })
      .from(registrations)
      .where(eq(registrations.id, regId));
    if (reg?.userId === userId) {
      return { status: 403, code: "OWN_MATCH", message: "Cannot score your own match" };
    }
  }
  const manager = await canManageTournament(userId, stage.tournamentId);
  const judge = await isJudgeOf(userId, stage.tournamentId);
  if (!manager && !judge) return { status: 403, code: "FORBIDDEN", message: "Not judge or manager" };
  return null;
}
