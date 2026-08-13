ALTER TYPE "public"."part_kind" ADD VALUE 'lock_chip';--> statement-breakpoint
ALTER TABLE "deck_slots" ADD COLUMN "lock_chip_id" uuid;--> statement-breakpoint
ALTER TABLE "deck_slots" ADD CONSTRAINT "deck_slots_lock_chip_id_parts_id_fk" FOREIGN KEY ("lock_chip_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;