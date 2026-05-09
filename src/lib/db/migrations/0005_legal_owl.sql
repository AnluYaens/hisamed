CREATE TABLE "vital_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinical_note_id" uuid,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"weight_kg" numeric(5, 2),
	"height_cm" numeric(5, 1),
	"bmi" numeric(4, 1),
	"systolic_bp" integer,
	"diastolic_bp" integer,
	"heart_rate" integer,
	"respiratory_rate" integer,
	"temperature_c" numeric(4, 1),
	"oxygen_saturation" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_clinical_note_id_clinical_notes_id_fk" FOREIGN KEY ("clinical_note_id") REFERENCES "public"."clinical_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vital_signs_clinic_patient_recorded_idx" ON "vital_signs" USING btree ("clinic_id","patient_id","recorded_at");--> statement-breakpoint
CREATE INDEX "vital_signs_clinical_note_idx" ON "vital_signs" USING btree ("clinical_note_id");