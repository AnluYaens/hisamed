import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

const DEV_PASSWORD = 'clinicamvp2026';

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

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await argon2.hash(DEV_PASSWORD);

  // ─── Clinic ───────────────────────────────────────────────────────────────

  const clinicId = id();
  await db.insert(schema.clinics).values({
    id: clinicId,
    name: 'Clínica Fertility Plus',
    address: 'Av. Principal de Las Mercedes, Torre Fertility, Piso 3, Caracas',
    phone: '+58 212 555 0100',
    timezone: 'America/Caracas',
  });
  console.log('✅ Clinic created');

  // ─── Users ────────────────────────────────────────────────────────────────

  const adminId = id();
  const doctorId = id();
  const receptionistId = id();

  await db.insert(schema.users).values([
    {
      id: adminId,
      clinicId,
      email: 'admin@fertilityplus.com',
      passwordHash,
      fullName: 'Carlos Mendoza (Admin)',
      role: 'admin',
      isActive: true,
    },
    {
      id: doctorId,
      clinicId,
      email: 'dra.garcia@fertilityplus.com',
      passwordHash,
      fullName: 'Dra. María García',
      role: 'doctor',
      isActive: true,
    },
    {
      id: receptionistId,
      clinicId,
      email: 'carmen.lopez@fertilityplus.com',
      passwordHash,
      fullName: 'Carmen López',
      role: 'receptionist',
      isActive: true,
    },
  ]);
  console.log('✅ Users created (password: clinicamvp2026)');

  // ─── Patients ─────────────────────────────────────────────────────────────

  const patientData = [
    { firstName: 'Ana', lastName: 'Rodríguez', idNumber: 'V-12345678', dob: '1990-03-15', phone: '+58 414 555 0101', email: 'ana.rodriguez@email.com' },
    { firstName: 'Luisa', lastName: 'Martínez', idNumber: 'V-15678901', dob: '1985-07-22', phone: '+58 424 555 0102', email: 'luisa.martinez@email.com' },
    { firstName: 'Carmen', lastName: 'Pérez', idNumber: 'V-18901234', dob: '1992-11-08', phone: '+58 412 555 0103', email: 'carmen.perez@email.com' },
    { firstName: 'María', lastName: 'González', idNumber: 'V-22345678', dob: '1988-04-30', phone: '+58 416 555 0104', email: '' },
    { firstName: 'Gabriela', lastName: 'López', idNumber: 'V-25678901', dob: '1995-09-14', phone: '+58 426 555 0105', email: 'gabriela.lopez@email.com' },
    { firstName: 'Valentina', lastName: 'Torres', idNumber: 'V-28901234', dob: '1993-01-25', phone: '+58 414 555 0106', email: '' },
    { firstName: 'Isabella', lastName: 'Flores', idNumber: 'V-31234567', dob: '1987-06-18', phone: '+58 424 555 0107', email: 'isabella.flores@email.com' },
    { firstName: 'Daniela', lastName: 'Ramírez', idNumber: 'V-34567890', dob: '1991-12-03', phone: '+58 412 555 0108', email: '' },
    { firstName: 'Sofía', lastName: 'Hernández', idNumber: 'V-37890123', dob: '1996-08-21', phone: '+58 416 555 0109', email: 'sofia.hernandez@email.com' },
    { firstName: 'Valeria', lastName: 'Díaz', idNumber: 'V-41234567', dob: '1989-02-14', phone: '+58 426 555 0110', email: '' },
    { firstName: 'Andrea', lastName: 'Morales', idNumber: 'V-44567890', dob: '1994-05-07', phone: '+58 414 555 0111', email: 'andrea.morales@email.com' },
    { firstName: 'Mariangel', lastName: 'Reyes', idNumber: 'V-47890123', dob: '1986-10-29', phone: '+58 424 555 0112', email: '' },
    { firstName: 'Alejandra', lastName: 'Jiménez', idNumber: 'V-51234567', dob: '1997-03-16', phone: '+58 412 555 0113', email: 'alejandra.jimenez@email.com' },
    { firstName: 'Patricia', lastName: 'Vargas', idNumber: 'V-54567890', dob: '1983-07-09', phone: '+58 416 555 0114', email: '' },
    { firstName: 'Stephanie', lastName: 'Castro', idNumber: 'V-57890123', dob: '1998-01-23', phone: '+58 426 555 0115', email: 'stephanie.castro@email.com' },
    { firstName: 'Karina', lastName: 'Ruiz', idNumber: 'V-61234567', dob: '1990-04-11', phone: '+58 414 555 0116', email: '' },
    { firstName: 'Vanessa', lastName: 'Suárez', idNumber: 'V-64567890', dob: '1993-09-27', phone: '+58 424 555 0117', email: 'vanessa.suarez@email.com' },
    { firstName: 'Natalia', lastName: 'Medina', idNumber: 'V-67890123', dob: '1988-06-05', phone: '+58 412 555 0118', email: '' },
    { firstName: 'Paola', lastName: 'Ortega', idNumber: 'V-71234567', dob: '1995-12-19', phone: '+58 416 555 0119', email: 'paola.ortega@email.com' },
    { firstName: 'Laura', lastName: 'Gutiérrez', idNumber: 'V-74567890', dob: '1991-08-02', phone: '+58 426 555 0120', email: '' },
  ];

  const patientIds = patientData.map(() => id());

  await db.insert(schema.patients).values(
    patientData.map((p, i) => ({
      id: patientIds[i],
      clinicId,
      idNumber: p.idNumber,
      idType: 'cedula' as const,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dob,
      sex: 'F' as const,
      phone: p.phone,
      email: p.email || undefined,
      isActive: true,
      createdBy: receptionistId,
    })),
  );
  console.log('✅ 20 patients created');

  // ─── Medical Histories (5 patients with full data) ────────────────────────

  const ginSpecialtyData = {
    menarche_age: 13,
    cycle_length_days: 28,
    cycle_regularity: 'regular',
    last_menstrual_period: '2026-04-01',
    contraceptive_method: 'none',
    pap_smear_last: '2025-10',
    mammography_last: null,
    gravida: 2,
    para: 1,
    cesarean: 1,
    abortions: 0,
    ectopic: 0,
    living_children: 1,
    obstetric_notes: '',
  };

  for (let i = 0; i < 5; i++) {
    await db.insert(schema.medicalHistories).values({
      id: id(),
      patientId: patientIds[i],
      personalHistory: 'Hipertensión arterial controlada con medicación oral.',
      familyHistory: 'Madre con diabetes tipo 2. Abuela materna con cáncer de mama.',
      surgicalHistory: 'Apendicectomía (2010). Sin complicaciones.',
      allergies: 'Penicilina (urticaria). Sin otras alergias conocidas.',
      currentMedications: 'Enalapril 10mg/día. Ácido fólico 400mcg/día.',
      habits: 'No fuma. No consume alcohol. Ejercicio moderado 3x/semana.',
      specialtyData: { ...ginSpecialtyData, gravida: i + 1, para: i },
      updatedBy: doctorId,
    });
  }

  // Remaining 15 patients get empty medical history
  for (let i = 5; i < 20; i++) {
    await db.insert(schema.medicalHistories).values({
      id: id(),
      patientId: patientIds[i],
      specialtyData: {},
      updatedBy: doctorId,
    });
  }
  console.log('✅ Medical histories created');

  // ─── Appointments (30 distributed this week) ──────────────────────────────

  const statuses: Array<typeof schema.appointments.$inferInsert['status']> = [
    'scheduled', 'confirmed', 'waiting', 'in_progress', 'completed', 'completed', 'no_show',
  ];

  const appointmentIds: string[] = [];
  for (let i = 0; i < 30; i++) {
    const aptId = id();
    appointmentIds.push(aptId);
    const dayOffset = (i % 7) - 3; // spread across -3 to +3 days
    const hour = 8 + (i % 9); // 8:00 to 16:00
    const minutes = i % 2 === 0 ? '00' : '30';
    const status = statuses[i % statuses.length];

    await db.insert(schema.appointments).values({
      id: aptId,
      clinicId,
      patientId: patientIds[i % 20],
      doctorId,
      date: toDateStr(dayOffset >= 0 ? daysFromNow(dayOffset) : daysAgo(-dayOffset)),
      startTime: `${hour.toString().padStart(2, '0')}:${minutes}`,
      endTime: `${(hour + 1).toString().padStart(2, '0')}:${minutes}`,
      status,
      reason: ['Control ginecológico', 'Revisión de resultados', 'Primera consulta', 'Seguimiento embarazo', 'Consulta por irregularidad menstrual'][i % 5],
      createdBy: receptionistId,
    });
  }
  console.log('✅ 30 appointments created');

  // ─── Clinical Notes (10 notes for first 5 patients) ───────────────────────

  const noteSpecialtyData = {
    blood_pressure: '120/80',
    weight_kg: 65.5,
    bmi: 24.2,
    last_menstrual_period: '2026-04-01',
    gestational_age_weeks: null,
    ultrasound_findings: '',
    follicle_count_left: null,
    follicle_count_right: null,
    endometrial_thickness_mm: null,
    procedure_performed: '',
    treatment_protocol: '',
  };

  for (let i = 0; i < 10; i++) {
    const patIdx = i % 5;
    const isSigned = i < 7; // first 7 are signed, last 3 are drafts
    const noteDate = toDateStr(daysAgo(i * 5));

    await db.insert(schema.clinicalNotes).values({
      id: id(),
      patientId: patientIds[patIdx],
      appointmentId: appointmentIds[i],
      authorId: doctorId,
      noteDate,
      chiefComplaint: 'Paciente acude a control ginecológico rutinario.',
      subjective: 'Paciente refiere ciclos menstruales regulares de 28 días. Sin dolor pélvico. Sin flujo vaginal anormal. Niega sangrado intermenstrual.',
      objective: 'PA: 120/80 mmHg. FC: 72 lpm. Peso: 65.5 kg. Talla: 1.64 m. IMC: 24.2. Abdomen blando, depresible, no doloroso. Genitales externos normales. Cuello uterino sin lesiones visibles.',
      assessment: 'Paciente en buen estado general. Ciclos menstruales regulares. Sin hallazgos patológicos en esta consulta.',
      plan: 'Se solicita Papanicolaou. Hemograma completo. Perfil hormonal (FSH, LH, estradiol, progesterona). Control en 3 meses. Se indica ácido fólico 400mcg/día.',
      diagnosisText: 'Control ginecológico normal',
      diagnosisCode: 'Z01.4',
      internalNotes: isSigned ? 'Paciente colaboradora. Seguimiento en orden.' : null,
      specialtyData: { ...noteSpecialtyData, bmi: 24.2 + i * 0.1 },
      isSigned,
      signedAt: isSigned ? new Date() : null,
    });
  }
  console.log('✅ 10 clinical notes created (7 signed, 3 drafts)');

  // ─── Audit log sample entries ─────────────────────────────────────────────

  await db.insert(schema.auditLogs).values([
    {
      id: id(),
      clinicId,
      userId: adminId,
      action: 'LOGIN',
      resourceType: 'session',
      details: { email: 'admin@fertilityplus.com' },
      ipAddress: '127.0.0.1',
    },
    {
      id: id(),
      clinicId,
      userId: doctorId,
      action: 'LOGIN',
      resourceType: 'session',
      details: { email: 'dra.garcia@fertilityplus.com' },
      ipAddress: '127.0.0.1',
    },
    {
      id: id(),
      clinicId,
      userId: receptionistId,
      action: 'CREATE',
      resourceType: 'patient',
      resourceId: patientIds[0],
      details: { patientName: 'Ana Rodríguez' },
      ipAddress: '127.0.0.1',
    },
  ]);
  console.log('✅ Audit log seeded');

  console.log('\n✨ Seed complete!');
  console.log('   Clinic: Clínica Fertility Plus');
  console.log('   Admin:        admin@fertilityplus.com');
  console.log('   Doctor:       dra.garcia@fertilityplus.com');
  console.log('   Receptionist: carmen.lopez@fertilityplus.com');
  console.log('   Password (all): clinicamvp2026');

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
