import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://tm@localhost:5433/tournament";

export const sql = postgres(url);
export const db = drizzle(sql, { schema });
