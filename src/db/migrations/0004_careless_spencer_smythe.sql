ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;