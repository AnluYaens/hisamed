import { config } from "dotenv";
config({ path: ".env.local" });
config(); // falls back to .env if .env.local has no DATABASE_URL
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, inArray } from "drizzle-orm";
import * as argon2 from "argon2";
import { v7 as uuidv7 } from "uuid";
import * as schema from "../src/lib/db/schema";
import { toDateStr } from "../src/lib/dates";
import {
  DEMO_CLINIC_ID,
  DEMO_USER_ID,
  DEMO_USER_EMAIL,
} from "../src/lib/auth/demo";

// Provisions the single shared, read-only demo clinic ("Consultorio Demo")
// that every "Probar demo" visitor logs into via the /demo route.
//
// Idempotent: it wipes any existing demo-clinic rows (in FK-safe order) and
// re-inserts from scratch, so running it again refreshes the sample data to a
// known-good state. Everything is scoped to DEMO_CLINIC_ID — it never touches
// real clinics.
//
// All names are deliberately fictional ("María Demo", "Carlos Ejemplo", …) so
// the demo data can never be mistaken for a real patient.

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo-readonly";

function id() {
  return uuidv7();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function wipeExistingDemo() {
  // Collect demo patient ids first — several child tables key off patient_id
  // rather than clinic_id.
  const demoPatients = await db
    .select({ id: schema.patients.id })
    .from(schema.patients)
    .where(eq(schema.patients.clinicId, DEMO_CLINIC_ID));
  const patientIds = demoPatients.map((p) => p.id);

  if (patientIds.length > 0) {
    await db
      .delete(schema.attachments)
      .where(inArray(schema.attachments.patientId, patientIds));
    await db
      .delete(schema.clinicalNotes)
      .where(inArray(schema.clinicalNotes.patientId, patientIds));
    await db
      .delete(schema.medicalHistories)
      .where(inArray(schema.medicalHistories.patientId, patientIds));
    await db
      .delete(schema.patientPartners)
      .where(inArray(schema.patientPartners.patientId, patientIds));
  }

  // Clinic-scoped tables.
  await db
    .delete(schema.clinicalDocuments)
    .where(eq(schema.clinicalDocuments.clinicId, DEMO_CLINIC_ID));
  await db
    .delete(schema.vitalSigns)
    .where(eq(schema.vitalSigns.clinicId, DEMO_CLINIC_ID));
  await db
    .delete(schema.appointments)
    .where(eq(schema.appointments.clinicId, DEMO_CLINIC_ID));
  await db
    .delete(schema.auditLogs)
    .where(eq(schema.auditLogs.clinicId, DEMO_CLINIC_ID));
  await db
    .delete(schema.patients)
    .where(eq(schema.patients.clinicId, DEMO_CLINIC_ID));
  await db
    .delete(schema.users)
    .where(eq(schema.users.clinicId, DEMO_CLINIC_ID));
  await db.delete(schema.clinics).where(eq(schema.clinics.id, DEMO_CLINIC_ID));
}

async function main() {
  console.log("🌱 Seeding demo clinic...");

  await wipeExistingDemo();

  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  // ─── Clinic ───────────────────────────────────────────────────────────────
  await db.insert(schema.clinics).values({
    id: DEMO_CLINIC_ID,
    name: "Consultorio Demo",
    address: "Av. Ejemplo 123, Ciudad Demo",
    phone: "+00 000 000 0000",
    timezone: "America/Caracas",
    weekStartsOn: 1,
    subscriptionStatus: "active", // never show the trial banner in the demo
  });
  console.log("✅ Clinic created (Consultorio Demo)");

  // ─── Demo doctor (fixed id so /demo + isDemoSession agree) ─────────────────
  await db.insert(schema.users).values({
    id: DEMO_USER_ID,
    clinicId: DEMO_CLINIC_ID,
    email: DEMO_USER_EMAIL,
    passwordHash,
    fullName: "Demo Ejemplo",
    role: "doctor",
    isActive: true,
  });
  console.log(`✅ Demo doctor created (${DEMO_USER_EMAIL})`);

  // ─── Patients (fictional names only) ───────────────────────────────────────
  const patientData = [
    {
      firstName: "María",
      lastName: "Demo",
      idNumber: "DEMO-00000001",
      dob: "1991-03-12",
      sex: "F" as const,
      phone: "+00 000 000 0001",
      email: "maria.demo@ejemplo.com",
    },
    {
      firstName: "Carlos",
      lastName: "Ejemplo",
      idNumber: "DEMO-00000002",
      dob: "1984-07-25",
      sex: "M" as const,
      phone: "+00 000 000 0002",
      email: "carlos.ejemplo@ejemplo.com",
    },
    {
      firstName: "Ana",
      lastName: "Prueba",
      idNumber: "DEMO-00000003",
      dob: "1996-11-03",
      sex: "F" as const,
      phone: "+00 000 000 0003",
      email: "",
    },
    {
      firstName: "José",
      lastName: "Muestra",
      idNumber: "DEMO-00000004",
      dob: "1979-01-19",
      sex: "M" as const,
      phone: "+00 000 000 0004",
      email: "jose.muestra@ejemplo.com",
    },
    {
      firstName: "Laura",
      lastName: "Ficticia",
      idNumber: "DEMO-00000005",
      dob: "2000-05-30",
      sex: "F" as const,
      phone: "+00 000 000 0005",
      email: "",
    },
    {
      firstName: "Pedro",
      lastName: "Demostración",
      idNumber: "DEMO-00000006",
      dob: "1988-09-08",
      sex: "M" as const,
      phone: "+00 000 000 0006",
      email: "pedro.demo@ejemplo.com",
    },
  ];

  const patientIds = patientData.map(() => id());

  await db.insert(schema.patients).values(
    patientData.map((p, i) => ({
      id: patientIds[i],
      clinicId: DEMO_CLINIC_ID,
      idNumber: p.idNumber,
      idType: "cedula" as const,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dob,
      sex: p.sex,
      phone: p.phone,
      email: p.email || undefined,
      isActive: true,
      createdBy: DEMO_USER_ID,
    })),
  );
  console.log(`✅ ${patientData.length} demo patients created`);

  // ─── Medical histories (first 3 patients get full data) ────────────────────
  for (let i = 0; i < patientData.length; i++) {
    const full = i < 3;
    await db.insert(schema.medicalHistories).values({
      id: id(),
      patientId: patientIds[i],
      personalHistory: full
        ? "Hipertensión arterial controlada. Sin otras patologías relevantes."
        : null,
      familyHistory: full
        ? "Padre con diabetes tipo 2. Sin antecedentes oncológicos conocidos."
        : null,
      surgicalHistory: full
        ? "Apendicectomía (2012), sin complicaciones."
        : null,
      allergies: full ? "Sin alergias conocidas." : null,
      currentMedications: full ? "Losartán 50 mg/día." : null,
      habits: full
        ? "No fuma. Actividad física moderada 3 veces por semana."
        : null,
      specialtyData: {},
      updatedBy: DEMO_USER_ID,
    });
  }
  console.log("✅ Medical histories created");

  // ─── Appointments (spread across this week) ────────────────────────────────
  const appointmentIds: string[] = [];
  const reasons = [
    "Consulta de control",
    "Primera consulta",
    "Revisión de resultados",
    "Seguimiento",
    "Chequeo general",
  ];
  for (let i = 0; i < 10; i++) {
    const aptId = id();
    appointmentIds.push(aptId);
    const dayOffset = (i % 7) - 3; // -3 .. +3
    const hour = 8 + (i % 8);
    const minutes = i % 2 === 0 ? "00" : "30";

    let status: (typeof schema.appointments.$inferInsert)["status"];
    if (dayOffset < 0) status = i % 5 === 0 ? "no_show" : "completed";
    else if (dayOffset === 0) status = "confirmed";
    else status = i % 3 === 0 ? "confirmed" : "scheduled";

    await db.insert(schema.appointments).values({
      id: aptId,
      clinicId: DEMO_CLINIC_ID,
      patientId: patientIds[i % patientData.length],
      doctorId: DEMO_USER_ID,
      date: toDateStr(
        dayOffset >= 0 ? daysFromNow(dayOffset) : daysAgo(-dayOffset),
      ),
      startTime: `${hour.toString().padStart(2, "0")}:${minutes}`,
      endTime: `${(hour + 1).toString().padStart(2, "0")}:${minutes}`,
      status,
      reason: reasons[i % reasons.length],
      createdBy: DEMO_USER_ID,
    });
  }
  console.log("✅ 10 appointments created");

  // ─── Clinical notes (a few, for the first 3 patients) ──────────────────────
  for (let i = 0; i < 5; i++) {
    const patIdx = i % 3;
    const isSigned = i < 3;
    await db.insert(schema.clinicalNotes).values({
      id: id(),
      patientId: patientIds[patIdx],
      appointmentId: appointmentIds[i],
      authorId: DEMO_USER_ID,
      noteDate: toDateStr(daysAgo(i * 7)),
      chiefComplaint: "Paciente acude a consulta de control de rutina.",
      subjective:
        "Refiere sentirse bien. Niega dolor, fiebre u otros síntomas relevantes.",
      objective:
        "PA: 120/80 mmHg. FC: 72 lpm. Buen estado general. Examen físico sin hallazgos patológicos.",
      assessment:
        "Paciente sano en consulta de control. Sin hallazgos patológicos.",
      plan: "Continuar hábitos saludables. Control en 6 meses. Se solicitan laboratorios de rutina.",
      diagnoses: [{ code: "Z00.0", text: "Examen médico general" }],
      internalNotes: isSigned ? "Paciente colaborador." : null,
      specialtyData: {},
      isSigned,
      signedAt: isSigned ? new Date() : null,
    });
  }
  console.log("✅ 5 clinical notes created (3 signed, 2 drafts)");

  console.log("\n✨ Demo seed complete!");
  console.log("   Clinic:  Consultorio Demo");
  console.log(`   Doctor:  ${DEMO_USER_EMAIL}`);
  console.log("   Access:  visit /demo (auto-login, read-only)");

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Demo seed failed:", err);
  process.exit(1);
});
