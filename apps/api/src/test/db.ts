import { sql } from "../db/client";

export async function truncateAll() {
  await sql`TRUNCATE TABLE users CASCADE`;
}
