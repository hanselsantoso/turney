import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "reg_open",
  "reg_closed",
  "check_in",
  "in_progress",
  "completed",
]);
export const stageFormatEnum = pgEnum("stage_format", [
  "round_robin",
  "swiss",
  "single_elim",
  "double_elim",
]);
export const stageScoringEnum = pgEnum("stage_scoring", ["win_loss", "points_accum"]);
export const stageStatusEnum = pgEnum("stage_status", ["pending", "active", "done"]);
export const staffRoleEnum = pgEnum("staff_role", ["organizer", "judge"]);
export const registrationStatusEnum = pgEnum("registration_status", [
  "pending",
  "paid",
  "checked_in",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["midtrans", "cash"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "settlement",
  "expire",
  "cancel",
]);

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

export const communities = pgTable("communities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  leaderId: uuid("leader_id").notNull().references(() => users.id),
  accentColor: text("accent_color"),
  bannerUrl: text("banner_url"),
  city: text("city"),
  region: text("region"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: uuid("community_id").notNull().references(() => communities.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.communityId, t.userId)],
);

export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  communityId: uuid("community_id").notNull().references(() => communities.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: tournamentStatusEnum("status").notNull().default("draft"),
  bannerUrl: text("banner_url"),
  prizePool: jsonb("prize_pool"),
  description: text("description"),
  rules: text("rules"),
  maxParticipants: integer("max_participants").notNull(),
  entryFee: integer("entry_fee").notNull().default(0),
  checkInEnabled: boolean("check_in_enabled").notNull().default(true),
  allowOnspotRegistration: boolean("allow_onspot_registration").notNull().default(true),
  startsAt: timestamp("starts_at").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournamentStages = pgTable("tournament_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  seq: integer("seq").notNull(),
  name: text("name").notNull(),
  format: stageFormatEnum("format").notNull(),
  scoring: stageScoringEnum("scoring").notNull(),
  pointsConfig: jsonb("points_config"),
  roundsPlanned: integer("rounds_planned"),
  advanceCount: integer("advance_count"),
  status: stageStatusEnum("status").notNull().default("pending"),
});

export const tournamentStaff = pgTable(
  "tournament_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    role: staffRoleEnum("role").notNull(),
    grantedBy: uuid("granted_by").notNull().references(() => users.id),
  },
  (t) => [unique().on(t.tournamentId, t.userId, t.role)],
);

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    status: registrationStatusEnum("status").notNull().default("pending"),
    seed: integer("seed"),
    qrToken: uuid("qr_token").notNull().defaultRandom().unique(),
    registeredBy: uuid("registered_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.tournamentId, t.userId)],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").notNull().references(() => registrations.id),
  method: paymentMethodEnum("method").notNull(),
  midtransOrderId: text("midtrans_order_id").unique(),
  amount: integer("amount").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  recordedBy: uuid("recorded_by").references(() => users.id),
  rawWebhook: jsonb("raw_webhook"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stadiums = pgTable("stadiums", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  name: text("name").notNull(),
  judgeId: uuid("judge_id").references(() => users.id),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").notNull().references(() => tournamentStages.id),
  name: text("name").notNull(),
  managerId: uuid("manager_id").references(() => users.id),
  advanceCount: integer("advance_count"),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id),
    registrationId: uuid("registration_id").notNull().references(() => registrations.id),
  },
  (t) => [unique().on(t.groupId, t.registrationId)],
);

export const groupMoves = pgTable("group_moves", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupIdFrom: uuid("group_id_from").references(() => groups.id),
  groupIdTo: uuid("group_id_to").notNull().references(() => groups.id),
  registrationId: uuid("registration_id").notNull().references(() => registrations.id),
  movedBy: uuid("moved_by").notNull().references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
