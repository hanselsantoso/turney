CREATE TYPE "public"."part_kind" AS ENUM('blade', 'ratchet', 'bit', 'assist_blade');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TABLE "deck_slots" (
	"deck_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"blade_id" uuid NOT NULL,
	"ratchet_id" uuid NOT NULL,
	"bit_id" uuid NOT NULL,
	"assist_blade_id" uuid,
	CONSTRAINT "deck_slots_deck_id_slot_unique" UNIQUE("deck_id","slot")
);
--> statement-breakpoint
CREATE TABLE "deck_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"judge_id" uuid NOT NULL,
	"status" "verification_status" NOT NULL,
	"notes" text,
	"verified_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "part_kind" NOT NULL,
	"name" text NOT NULL,
	"alias" text,
	"attack" integer DEFAULT 0 NOT NULL,
	"defense" integer DEFAULT 0 NOT NULL,
	"stamina" integer DEFAULT 0 NOT NULL,
	"type" text,
	"line" text,
	"points" integer,
	"extra" jsonb,
	"image_url" text,
	CONSTRAINT "parts_kind_name_unique" UNIQUE("kind","name")
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "deck_id" uuid;--> statement-breakpoint
ALTER TABLE "deck_slots" ADD CONSTRAINT "deck_slots_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_slots" ADD CONSTRAINT "deck_slots_blade_id_parts_id_fk" FOREIGN KEY ("blade_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_slots" ADD CONSTRAINT "deck_slots_ratchet_id_parts_id_fk" FOREIGN KEY ("ratchet_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_slots" ADD CONSTRAINT "deck_slots_bit_id_parts_id_fk" FOREIGN KEY ("bit_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_slots" ADD CONSTRAINT "deck_slots_assist_blade_id_parts_id_fk" FOREIGN KEY ("assist_blade_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_verifications" ADD CONSTRAINT "deck_verifications_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_verifications" ADD CONSTRAINT "deck_verifications_judge_id_users_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;