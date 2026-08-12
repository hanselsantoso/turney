import { pgTable, uuid, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  playerCode: text("player_code").notNull().unique(),
  city: text("city"),
  region: text("region"),
  birthYear: integer("birth_year"),
  gender: text("gender"),
  elo: integer("elo").notNull().default(1000),
  avatarUrl: text("avatar_url"),
  refreshTokenHash: text("refresh_token_hash"),
  onboardedAt: timestamp("onboarded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
