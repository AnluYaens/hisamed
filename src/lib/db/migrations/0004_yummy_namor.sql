CREATE TYPE "public"."blood_type" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');--> statement-breakpoint
CREATE TABLE "patient_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"id_number" varchar(50),
	"date_of_birth" date,
	"phone" varchar(50),
	"email" varchar(255),
	"blood_type" "blood_type",
	"occupation" varchar(255),
	"notes" text,
	"avatar_storage_key" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patient_partners_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "blood_type" "blood_type";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "rh_incompatibility" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "instagram" varchar(100);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "referral_source" varchar(255);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "occupation" varchar(255);--> statement-breakpoint
ALTER TABLE "patient_partners" ADD CONSTRAINT "patient_partners_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_partners_patient_id_idx" ON "patient_partners" USING btree ("patient_id");