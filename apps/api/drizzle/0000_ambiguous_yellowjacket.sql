CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"player_code" text NOT NULL,
	"city" text,
	"region" text,
	"birth_year" integer,
	"gender" text,
	"elo" integer DEFAULT 1000 NOT NULL,
	"avatar_url" text,
	"refresh_token_hash" text,
	"onboarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_player_code_unique" UNIQUE("player_code")
);
