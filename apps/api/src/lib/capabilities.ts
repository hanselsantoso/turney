import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { communities, tournaments, tournamentStaff, users } from "../db/schema";

/* Everyone is a player. Management capability on a tournament comes from:
   platform admin, OR leader of the hosting community, OR organizer staff grant. */
export async function canManageTournament(userId: string, tournamentId: string) {
  const [u] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId));
  if (u?.isAdmin) return true;

  const [t] = await db
    .select({ leaderId: communities.leaderId })
    .from(tournaments)
    .innerJoin(communities, eq(tournaments.communityId, communities.id))
    .where(eq(tournaments.id, tournamentId));
  if (t?.leaderId === userId) return true;

  const staff = await db
    .select()
    .from(tournamentStaff)
    .where(
      and(
        eq(tournamentStaff.tournamentId, tournamentId),
        eq(tournamentStaff.userId, userId),
        eq(tournamentStaff.role, "organizer"),
      ),
    );
  return staff.length > 0;
}

export async function canCreateTournamentIn(userId: string, communityId: string) {
  const [u] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId));
  if (u?.isAdmin) return true;
  const [c] = await db
    .select({ leaderId: communities.leaderId })
    .from(communities)
    .where(eq(communities.id, communityId));
  return c?.leaderId === userId;
}
