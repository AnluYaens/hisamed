import 'dotenv/config';
import * as readline from 'readline';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import * as schema from '../src/lib/db/schema';

// Prefer session pooler (port 5432) — required for DDL and for WSL2 → Supabase connectivity.
// Falls back to DATABASE_URL. A CLI argument overrides everything.
const rawUrl = process.argv[2] ?? process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('Error: define MIGRATE_DATABASE_URL en .env o pasa la URL como argumento.');
  process.exit(1);
}

// pg v8+ treats sslmode=require as verify-full; uselibpqcompat restores libpq semantics.
const connectionString = rawUrl.includes('uselibpqcompat')
  ? rawUrl
  : rawUrl.replace(/(\?|&)(sslmode=require)/, '$1$2&uselibpqcompat=true');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function askPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    rl.pause();

    const stdin = process.stdin as NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void };
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();

    let password = '';

    function onData(buf: Buffer) {
      const char = buf.toString();

      if (char === '\r' || char === '\n' || char === '') {
        stdin.removeListener('data', onData);
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write('\n');
        rl.resume();
        resolve(password);
      } else if (char === '' || char === '') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (char >= ' ') {
        password += char;
        process.stdout.write('*');
      }
    }

    stdin.on('data', onData);
  });
}

const TIMEZONES = [
  'America/Caracas',
  'America/Bogota',
  'America/Lima',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'Europe/Madrid',
];

async function main() {
  console.log('\n=== Crear primer usuario admin — Producción ===\n');

  // ── Datos de la clínica ──────────────────────────────────────────────────────
  console.log('Datos de la clínica:');
  const clinicName = await ask('  Nombre: ');
  if (!clinicName) { console.error('El nombre de la clínica es obligatorio.'); process.exit(1); }

  const clinicAddress = await ask('  Dirección (opcional): ');
  const clinicPhone   = await ask('  Teléfono   (opcional): ');

  console.log('\n  Timezones disponibles:');
  TIMEZONES.forEach((tz, i) => console.log(`    ${(i + 1).toString().padStart(2)}. ${tz}`));
  const tzRaw = await ask(`  Timezone [1-${TIMEZONES.length}] (Enter = America/Caracas): `);
  const tzIdx = parseInt(tzRaw, 10) - 1;
  const timezone = TIMEZONES[tzIdx] ?? 'America/Caracas';

  // ── Datos del usuario admin ──────────────────────────────────────────────────
  console.log('\nDatos del usuario admin:');
  const email    = await ask('  Email: ');
  const fullName = await ask('  Nombre completo: ');

  if (!email || !fullName) { console.error('Email y nombre completo son obligatorios.'); process.exit(1); }

  const password        = await askPassword('  Contraseña: ');
  const passwordConfirm = await askPassword('  Confirmar contraseña: ');

  if (password !== passwordConfirm) {
    console.error('Error: las contraseñas no coinciden.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Error: la contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  // ── Resumen y confirmación ───────────────────────────────────────────────────
  console.log('\n── Resumen ──────────────────────────────────────────');
  console.log(`  Clínica:  ${clinicName}`);
  if (clinicAddress) console.log(`  Dirección: ${clinicAddress}`);
  if (clinicPhone)   console.log(`  Teléfono:  ${clinicPhone}`);
  console.log(`  Timezone: ${timezone}`);
  console.log(`  Admin:    ${fullName} <${email}>`);
  console.log('─────────────────────────────────────────────────────');

  const confirm = await ask('\n¿Confirmar e insertar en la base de datos? [s/N] ');
  rl.close();

  if (!['s', 'si', 'sí'].includes(confirm.toLowerCase())) {
    console.log('Cancelado.');
    process.exit(0);
  }

  // ── Hash de contraseña ───────────────────────────────────────────────────────
  console.log('\nHasheando contraseña...');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // ── Conexión y escritura ─────────────────────────────────────────────────────
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    console.log('Conectando...');

    const [clinic] = await db
      .insert(schema.clinics)
      .values({
        name: clinicName,
        address: clinicAddress || undefined,
        phone: clinicPhone || undefined,
        timezone,
      })
      .returning();

    console.log(`✅ Clínica creada  → ${clinic.name} (id: ${clinic.id})`);

    const [user] = await db
      .insert(schema.users)
      .values({
        clinicId: clinic.id,
        email,
        passwordHash,
        fullName,
        role: 'admin',
        isActive: true,
      })
      .returning();

    console.log(`✅ Admin creado    → ${user.fullName} <${user.email}> (id: ${user.id})`);
    console.log('\n✨ Listo. Puedes iniciar sesión en producción con esas credenciales.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message ?? err);
  process.exit(1);
});
