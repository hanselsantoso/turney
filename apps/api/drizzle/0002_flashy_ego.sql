CREATE TYPE "public"."finish_type" AS ENUM('xtreme', 'burst', 'over', 'spin');--> statement-breakpoint
CREATE TYPE "public"."match_bracket" AS ENUM('winners', 'losers', 'grand_final');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'scheduled', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"winner_reg_id" uuid NOT NULL,
	"finish_type" "finish_type" NOT NULL,
	"points" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elo_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"elo_before" integer NOT NULL,
	"elo_after" integer NOT NULL,
	"delta" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"bracket_pos" integer NOT NULL,
	"bracket" "match_bracket" DEFAULT 'winners' NOT NULL,
	"group_id" uuid,
	"p1_reg_id" uuid,
	"p2_reg_id" uuid,
	"winner_reg_id" uuid,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"stadium_id" uuid
);
--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_reg_id_registrations_id_fk" FOREIGN KEY ("winner_reg_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stage_id_tournament_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."tournament_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_p1_reg_id_registrations_id_fk" FOREIGN KEY ("p1_reg_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_p2_reg_id_registrations_id_fk" FOREIGN KEY ("p2_reg_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_reg_id_registrations_id_fk" FOREIGN KEY ("winner_reg_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_stadiums_id_fk" FOREIGN KEY ("stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE no action ON UPDATE no action;