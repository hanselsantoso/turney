import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { tournamentStaff } from "../db/schema";

export async function isJudgeOf(userId: string, tournamentId: string) {
  const rows = await db
    .select()
    .from(tournamentStaff)
    .where(
      and(
        eq(tournamentStaff.tournamentId, tournamentId),
        eq(tournamentStaff.userId, userId),
        eq(tournamentStaff.role, "judge"),
      ),
    );
  return rows.length > 0;
}
