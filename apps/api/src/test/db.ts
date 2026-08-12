import { sql } from "../db/client";

export async function truncateAll() {
  await sql`TRUNCATE TABLE
    group_moves, group_members, groups, stadiums, payments, registrations,
    tournament_staff, tournament_stages, tournaments,
    community_members, communities, users
    CASCADE`;
}
