CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"semester" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_class_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"status" text DEFAULT 'PROMOTED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "nik" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "religion" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "father_name" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "father_occupation" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "mother_name" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "mother_occupation" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "guardian_name" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "guardian_phone" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "target_role" text;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "academic_year_id" uuid;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;