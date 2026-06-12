import { db } from '../src/lib/db';
import { clinics, users, patients, clinicalNotes } from '../src/lib/db/schema';
import { todayInTz } from '../src/lib/dates';
import { eq, and, inArray } from 'drizzle-orm';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_DOB = '1970-01-01';
const DEFAULT_SEX: 'F' | 'M' | 'other' = 'F';

type DateFormat = 'mdy' | 'dmy';

interface CliArgs {
  targetDoctorEmail: string;
  dryRun: boolean;
  notesOnly: boolean;
  limit: number | null;
  dateFormat: DateFormat;
  verbose: boolean;
  sourceDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  let targetDoctorEmail = '';
  let commit = false;
  let notesOnly = false;
  let limit: number | null = null;
  let dateFormat: DateFormat = 'mdy';
  let verbose = false;
  let sourceDir = process.cwd();

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') {
      commit = true;
    } else if (a === '--dry-run') {
      commit = false;
    } else if (a === '--notes-only' || a === '--backfill-notes') {
      notesOnly = true;
    } else if (a === '--verbose') {
      verbose = true;
    } else if (a === '--source-dir') {
      const v = argv[++i];
      if (!v) {
        console.error('❌ --source-dir requires a path.');
        process.exit(1);
      }
      sourceDir = path.resolve(process.cwd(), v);
    } else if (a.startsWith('--source-dir=')) {
      const v = a.slice('--source-dir='.length);
      if (!v) {
        console.error('❌ --source-dir requires a path.');
        process.exit(1);
      }
      sourceDir = path.resolve(process.cwd(), v);
    } else if (a === '--limit') {
      const n = parseInt(argv[++i], 10);
      if (isNaN(n) || n <= 0) {
        console.error('❌ --limit requires a positive integer.');
        process.exit(1);
      }
      limit = n;
    } else if (a.startsWith('--limit=')) {
      const n = parseInt(a.slice('--limit='.length), 10);
      if (isNaN(n) || n <= 0) {
        console.error('❌ --limit requires a positive integer.');
        process.exit(1);
      }
      limit = n;
    } else if (a === '--date-format') {
      const v = argv[++i];
      if (v !== 'mdy' && v !== 'dmy') {
        console.error("❌ --date-format must be 'mdy' or 'dmy'.");
        process.exit(1);
      }
      dateFormat = v;
    } else if (a.startsWith('--date-format=')) {
      const v = a.slice('--date-format='.length);
      if (v !== 'mdy' && v !== 'dmy') {
        console.error("❌ --date-format must be 'mdy' or 'dmy'.");
        process.exit(1);
      }
      dateFormat = v;
    } else if (!a.startsWith('--')) {
      positional.push(a);
    } else {
      console.error(`❌ Unknown flag: ${a}`);
      process.exit(1);
    }
  }

  targetDoctorEmail = positional[0] ?? '';
  return {
    targetDoctorEmail,
    dryRun: !commit,
    notesOnly,
    limit,
    dateFormat,
    verbose,
    sourceDir,
  };
}

function printVerboseRow(opts: {
  rowIdx: number;
  rawNombre: string;
  rawApellido1: string;
  rawApellido2: string;
  firstName: string;
  lastName: string;
  rawDOB: string;
  parsedDOB: string;
  sex: 'F' | 'M' | 'other';
  usedDefaultSex: boolean;
  rawSex: string;
  idNumber: string;
  usedFallback: boolean;
  fallbackDetail: string | null;
  notesRouting: string;
  flags: string[];
}) {
  const line = '─'.repeat(64);
  console.log(line);
  console.log(`Row #${opts.rowIdx}`);
  console.log(
    `  Source name:   NOMBRE="${opts.rawNombre}" APELLIDO1="${opts.rawApellido1}" APELLIDO2="${opts.rawApellido2}"`,
  );
  console.log(
    `  Mapped name:   firstName="${opts.firstName}" lastName="${opts.lastName}"`,
  );
  console.log(
    `  DOB:           "${opts.rawDOB || '(empty)'}" → ${opts.parsedDOB}`,
  );
  console.log(
    `  Sex:           ${opts.sex}${opts.usedDefaultSex ? ` (defaulted — raw="${opts.rawSex || '(empty)'}")` : ` (from raw="${opts.rawSex}")`}`,
  );
  if (opts.usedFallback) {
    console.log(
      `  idNumber:      ${opts.idNumber}  [MIG- fallback — ${opts.fallbackDetail}]`,
    );
  } else {
    console.log(`  idNumber:      ${opts.idNumber}  [source ID]`);
  }
  console.log(`  Notes routing: ${opts.notesRouting}`);
  console.log(
    `  Flags:         ${opts.flags.length ? opts.flags.join(', ') : '(none)'}`,
  );
}

interface ParsedDate {
  iso: string;
  usedDefault: boolean;
  unparseable: boolean;
  futureOrImplausible: boolean;
}

const TODAY = new Date();

function parseAndFormatDate(
  dateStr: string | undefined,
  format: DateFormat,
): ParsedDate {
  if (!dateStr || dateStr.trim() === '') {
    return {
      iso: DEFAULT_DOB,
      usedDefault: true,
      unparseable: false,
      futureOrImplausible: false,
    };
  }

  const cleanStr = dateStr.replace(/\//g, '-').trim();
  const parts = cleanStr.split('-');

  if (parts.length === 3) {
    let first = parseInt(parts[0], 10);
    let second = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    if (!isNaN(first) && !isNaN(second) && !isNaN(year)) {
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      let month: number;
      let day: number;
      if (format === 'mdy') {
        month = first;
        day = second;
        if (month > 12 && day <= 12) {
          const t = month;
          month = day;
          day = t;
        }
      } else {
        day = first;
        month = second;
        if (month > 12 && day <= 12) {
          const t = month;
          month = day;
          day = t;
        }
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return {
          iso,
          usedDefault: false,
          unparseable: false,
          futureOrImplausible: false,
        };
      }
    }
  }

  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      iso,
      usedDefault: false,
      unparseable: false,
      futureOrImplausible: false,
    };
  }

  return {
    iso: DEFAULT_DOB,
    usedDefault: true,
    unparseable: true,
    futureOrImplausible: false,
  };
}

function isFutureOrImplausibleDOB(iso: string): boolean {
  if (iso === DEFAULT_DOB) return false;
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  const oneYearAgo = new Date(TODAY);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  return d > oneYearAgo;
}

function correctTwoDigitDobCentury(
  parsed: ParsedDate,
  rawDOB: string | undefined,
): ParsedDate {
  if (!rawDOB || !isFutureOrImplausibleDOB(parsed.iso)) return parsed;

  const hasTwoDigitYear = /^\s*\d{1,2}[/-]\d{1,2}[/-]\d{2}(?:\D|$)/.test(rawDOB);
  if (!hasTwoDigitYear) return parsed;

  const year = Number(parsed.iso.slice(0, 4));
  if (Number.isNaN(year) || year < 2000) return parsed;

  return {
    ...parsed,
    iso: `${year - 100}${parsed.iso.slice(4)}`,
    futureOrImplausible: false,
  };
}

function deterministicFallbackKey(
  firstName: string,
  lastName: string,
  rawDOB: string,
  rawSex: string,
): string {
  const h = crypto
    .createHash('sha256')
    .update(
      [firstName, lastName, rawDOB, rawSex]
        .map((s) => (s ?? '').trim().toUpperCase())
        .join('|'),
    )
    .digest('hex');
  return h.slice(0, 12);
}

type BlobExtraction =
  | { kind: 'empty'; ignoredFutureDates: string[] }
  | { kind: 'undated'; text: string; ignoredFutureDates: string[] }
  | {
      kind: 'dated';
      segments: { noteDate: string; content: string }[];
      ignoredFutureDates: string[];
    };

function parseBlobDate(
  firstRaw: string,
  secondRaw: string,
  yearRaw: string,
  format: DateFormat,
): string | null {
  let first = parseInt(firstRaw, 10);
  let second = parseInt(secondRaw, 10);
  let year = parseInt(yearRaw, 10);

  if (isNaN(first) || isNaN(second) || isNaN(year)) return null;
  if (year < 100) year += year > 50 ? 1900 : 2000;
  if (year < 1900) return null;

  let month: number;
  let day: number;
  if (format === 'mdy') {
    month = first;
    day = second;
    if (month > 12 && day <= 12) {
      const t = month;
      month = day;
      day = t;
    }
  } else {
    day = first;
    month = second;
    if (month > 12 && day <= 12) {
      const t = month;
      month = day;
      day = t;
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidateDate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidateDate.getUTCFullYear() !== year ||
    candidateDate.getUTCMonth() !== month - 1 ||
    candidateDate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractNotesFromBlob(
  blobText: string,
  format: DateFormat,
  opts: { alternateFormat?: DateFormat; maxDate?: string } = {},
): BlobExtraction {
  if (!blobText || blobText.trim() === '')
    return { kind: 'empty', ignoredFutureDates: [] };

  const dateRegex = /(?:^|\n)(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})[\s,.:]+/g;

  const segments: { noteDate: string; content: string }[] = [];
  const markers: {
    index: number;
    dateStr: string | null;
    matchLength: number;
  }[] = [];
  const ignoredFutureDates: string[] = [];
  let match;

  while ((match = dateRegex.exec(blobText)) !== null) {
    const rawMarker = `${match[1]}/${match[2]}/${match[3]}`;
    const rawYear = parseInt(match[3], 10);
    const normalizedYear =
      rawYear < 100 ? rawYear + (rawYear > 50 ? 1900 : 2000) : rawYear;

    if (isNaN(normalizedYear) || normalizedYear < 1900) {
      ignoredFutureDates.push(`${rawMarker} -> invalid year`);
      markers.push({
        index: match.index,
        dateStr: null,
        matchLength: match[0].length,
      });
      continue;
    }

    let formattedDate = parseBlobDate(match[1], match[2], match[3], format);

    if (
      formattedDate &&
      opts.maxDate &&
      formattedDate > opts.maxDate &&
      opts.alternateFormat
    ) {
      const alternate = parseBlobDate(
        match[1],
        match[2],
        match[3],
        opts.alternateFormat,
      );
      if (alternate && alternate <= opts.maxDate) formattedDate = alternate;
    }

    if (!formattedDate) continue;
    if (opts.maxDate && formattedDate > opts.maxDate) {
      ignoredFutureDates.push(`${rawMarker} -> ${formattedDate}`);
      markers.push({
        index: match.index,
        dateStr: null,
        matchLength: match[0].length,
      });
      continue;
    }

    markers.push({
      index: match.index,
      dateStr: formattedDate,
      matchLength: match[0].length,
    });
  }

  if (!markers.some((marker) => marker.dateStr !== null)) {
    return { kind: 'undated', text: blobText.trim(), ignoredFutureDates };
  }

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    if (current.dateStr === null) continue;

    const startText = current.index + current.matchLength;
    const endText =
      i + 1 < markers.length ? markers[i + 1].index : blobText.length;

    const textContent = blobText.substring(startText, endText).trim();
    if (textContent.length > 0) {
      segments.push({
        noteDate: current.dateStr,
        content: textContent,
      });
    }
  }

  if (segments.length === 0) return { kind: 'empty', ignoredFutureDates };
  return { kind: 'dated', segments, ignoredFutureDates };
}

const MIGRATED_NOTES_PREFIX = 'Historial migrado (HipoSEMG): ';
const MIGRATED_CHIEF_COMPLAINT = 'Historial migrado (HipoSEMG)';
const MIGRATED_STRUCTURED_PLACEHOLDER =
  'Registro histórico migrado del sistema anterior (HipoSEMG). Sin detalle clínico estructurado.';

function normalizeNoteContent(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/[ \t]+/g, ' ');
}

function noteDedupeKey(noteDate: string, content: string): string {
  return `${noteDate}|${normalizeNoteContent(content)}`;
}

function trimField(row: any, key: string): string {
  const value = row[key];
  return value == null ? '' : String(value).trim();
}

function addHistoricalBlock(
  map: Map<string, string[]>,
  patientKey: string,
  block: string,
) {
  if (!map.has(patientKey)) map.set(patientKey, []);
  map.get(patientKey)!.push(block);
}

function buildActosBlock(row: any): { patientKey: string; block: string } | null {
  const patientKey = trimField(row, 'Clave').replace(/,/g, '');
  const fechaRaw = trimField(row, 'Fecha');
  const cleanDate = fechaRaw.split(' ')[0] || '';

  const contentLines = [
    ['Acto', trimField(row, 'Acto')],
    ['Motivo', trimField(row, 'Motivo')],
    ['Exploración', trimField(row, 'Explor')],
    ['Tratamiento', trimField(row, 'Tratamiento')],
    ['Consejos', trimField(row, 'Consejos')],
    ['Otros', trimField(row, 'Otros')],
    ['Firma', trimField(row, 'Firma')],
  ]
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`);

  if (!patientKey || !cleanDate || contentLines.length === 0) return null;

  return {
    patientKey,
    block: `\n${cleanDate}\n${contentLines.join('\n')}\n`,
  };
}

interface SkipEntry {
  rowIdx: number;
  identifier: string;
  reason: string;
}

interface FlagEntry {
  rowIdx: number;
  identifier: string;
  value: string;
}

interface AfilSeen {
  rowIdx: number;
  identifier: string;
  firstName: string;
  lastName: string;
  afiliado: string;
  nip: string;
  rawDOB: string;
}

interface PatientPlan {
  rowIdx: number;
  identifier: string;
  values: typeof patients.$inferInsert;
  noteSegments: { noteDate: string; content: string }[];
  registrationDateStr: string;
}

interface NotesOnlyInsertPlan {
  patientId: string;
  notes: { noteDate: string; content: string }[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.targetDoctorEmail) {
    console.error(
      '\n❌ Error: No especificaste la clínica destino para la migración.',
    );
    console.error(
      '💡 Uso: pnpm tsx scripts/migrate-hiposeme.ts <email_doctor> [--source-dir data-migrations/hiposeme-papa-produccion] [--commit] [--limit N] [--date-format mdy|dmy] [--verbose]',
    );
    console.error(
      '      Por defecto corre en DRY-RUN. Usa --commit para escribir realmente.\n',
    );
    process.exit(1);
  }

  const mode = args.dryRun
    ? 'DRY-RUN (no DB writes)'
    : 'COMMIT (writes will persist)';
  console.log(`\n🛡️  Modo: ${mode}`);
  console.log(
    `📅 Date format (DOB + Actos): ${args.dateFormat.toUpperCase()} | Filiacion.Nota: DMY`,
  );
  if (args.limit !== null) console.log(`🔬 Limit: ${args.limit} filas`);
  if (args.verbose) console.log(`🔍 Verbose: on (per-row detail)`);
  console.log(`📁 Source dir: ${args.sourceDir}`);
  console.log(`📧 Doctor destino: ${args.targetDoctorEmail}\n`);

  const doctorUser = await db.query.users.findFirst({
    where: eq(users.email, args.targetDoctorEmail),
  });

  if (!doctorUser || !doctorUser.clinicId) {
    console.error(
      `❌ El usuario "${args.targetDoctorEmail}" no existe o no tiene clinicId.`,
    );
    process.exit(1);
  }

  const { clinicId, id: authorId } = doctorUser;
  console.log(`🎯 Clinic ID: ${clinicId} | Author ID: ${authorId}`);

  const clinic = await db.query.clinics.findFirst({
    where: eq(clinics.id, clinicId),
  });
  const clinicTimezone = clinic?.timezone ?? 'America/Caracas';
  const clinicToday = todayInTz(clinicTimezone);
  console.log(`🕒 Clinic timezone: ${clinicTimezone} | Today: ${clinicToday}`);

  const filiacionPath = path.join(args.sourceDir, 'Filiacion.csv');
  const actosPath = path.join(args.sourceDir, 'Actos.csv');
  const enfactPath = path.join(args.sourceDir, 'EnfAct.csv');

  if (!fs.existsSync(args.sourceDir)) {
    console.error(`❌ No se encontró la carpeta source-dir: ${args.sourceDir}`);
    process.exit(1);
  }

  // Verificar la existencia de ambos archivos antes de arrancar
  if (!fs.existsSync(filiacionPath)) {
    console.error(`❌ No se encontró 'Filiacion.csv' en: ${filiacionPath}`);
    process.exit(1);
  }

  // --- PASO EXTRA: CARGA RELACIONAL EN MEMORIA DE LAS NOTAS CLÍNICAS ---
  const historialClinicoMap = new Map<string, string[]>();

  if (fs.existsSync(actosPath)) {
    console.log(`⏳ Indexando histórico de notas clínicas desde ${actosPath}...`);
    let actosRowsRead = 0;
    let actosRowsMapped = 0;
    await new Promise((resolve, reject) => {
      fs.createReadStream(actosPath)
        .pipe(csv())
        .on('data', (row) => {
          actosRowsRead++;
          const built = buildActosBlock(row);
          if (!built) return;

          addHistoricalBlock(
            historialClinicoMap,
            built.patientKey,
            built.block,
          );
          actosRowsMapped++;
        })
        .on('end', resolve)
        .on('error', reject);
    });
    console.log(
      `✅ Actos clínicos leídos: ${actosRowsRead}. Mapeados como notas: ${actosRowsMapped}. Pacientes con notas: ${historialClinicoMap.size}.`,
    );
  } else if (fs.existsSync(enfactPath)) {
    console.log(
      `⏳ Indexando histórico de notas clínicas desde ${enfactPath} (formato legado)...`,
    );
    await new Promise((resolve, reject) => {
      fs.createReadStream(enfactPath)
        .pipe(csv())
        .on('data', (row) => {
          const nh = row.N_H?.trim();
          const fechaRaw = row.FECHAE?.trim() || '';
          const motivo = row.MOTIVO?.trim() || '';
          const anota = row.ANOTA?.trim() || '';

          if (nh && (anota || motivo)) {
            const cleanDate = fechaRaw.split(' ')[0] || '';
            const bloqueNota = `\n${cleanDate}\nMotivo: ${motivo}\nNota: ${anota}\n`;

            addHistoricalBlock(historialClinicoMap, nh, bloqueNota);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    console.log(
      `✅ Historiales clínicos cargados en memoria para ${historialClinicoMap.size} identificadores.`,
    );
  } else {
    console.log(
      "⚠️ No se detectó 'Actos.csv' ni 'EnfAct.csv'. Se procederá solo con los datos de filiación.",
    );
  }
  // ---------------------------------------------------------------------------------

  const rows: any[] = await new Promise((resolve, reject) => {
    const out: any[] = [];
    fs.createReadStream(filiacionPath)
      .pipe(csv({ quote: '"', escape: '"' }))
      .on('data', (data) => {
        if (data.NOMBRE || data.APELLIDO1 || data.Clave || data.AFILIADO) {
          out.push(data);
        }
      })
      .on('end', () => resolve(out))
      .on('error', reject);
  });

  const totalRead = rows.length;
  const toProcess = args.limit !== null ? rows.slice(0, args.limit) : rows;
  console.log(
    `📦 Filas leídas de Filiacion: ${totalRead}. A procesar: ${toProcess.length}.\n`,
  );

  let mapped = 0;
  let notesPlanned = 0;
  let patientsInserted = 0;
  let patientsMatchedExisting = 0;
  let notesInserted = 0;
  let notesSkippedExistingPatient = 0;
  let patientsWithDatedClinicalNotes = 0;
  let patientsWithMigratedNotesField = 0;
  let notesAlreadyExisting = 0;
  let notesOnlyNotesWithoutPatient = 0;
  let notesOnlyPatientsMatched = 0;
  const skipped: SkipEntry[] = [];
  const defaultDOB: FlagEntry[] = [];
  const defaultSex: FlagEntry[] = [];
  const unparseableDates: FlagEntry[] = [];
  const fallbackIds: FlagEntry[] = [];
  const futureDOBs: FlagEntry[] = [];
  const futureNoteDates: FlagEntry[] = [];
  const notesOnlyPatientsNotFound: FlagEntry[] = [];
  const mappedLunacim: FlagEntry[] = [];
  const mappedLocalidad: FlagEntry[] = [];

  const seenAfiliados = new Map<string, AfilSeen>();
  const collisionGroups = new Map<string, AfilSeen[]>();
  let afiliadoDuplicatesSeparated = 0;

  const plans: PatientPlan[] = [];

  toProcess.forEach((row, idx) => {
    const rowIdx = idx + 1;
    try {
      const firstName = row.NOMBRE?.trim() || 'Sin Nombre';
      const lastName =
        `${row.APELLIDO1?.trim() || ''} ${row.APELLIDO2?.trim() || ''}`.trim() ||
        'Sin Apellido';
      const identifier = `#${rowIdx} ${firstName} ${lastName}`;

      const cleanIdField = (v: any): string =>
        v == null ? '' : v.toString().replace(/,/g, '').trim();

      const afilRaw = cleanIdField(row.AFILIADO);
      const nipRaw = cleanIdField(row.NIP);
      const nifRaw = cleanIdField(row.NIF);
      const cipRaw = cleanIdField(row.CIP);
      const claveRaw = cleanIdField(row.Clave);
      const rawDOB = row.FENAC;

      let rawId: string;
      let afiliadoCollided = false;

      if (afilRaw) {
        const prior = seenAfiliados.get(afilRaw);
        if (prior) {
          afiliadoCollided = true;
          afiliadoDuplicatesSeparated++;
          const currentInfo: AfilSeen = {
            rowIdx,
            identifier,
            firstName,
            lastName,
            afiliado: afilRaw,
            nip: nipRaw,
            rawDOB: rawDOB ?? '',
          };
          let group = collisionGroups.get(afilRaw);
          if (!group) {
            group = [prior];
            collisionGroups.set(afilRaw, group);
          }
          group.push(currentInfo);
          rawId = nipRaw || nifRaw || cipRaw || claveRaw || '';
        } else {
          seenAfiliados.set(afilRaw, {
            rowIdx,
            identifier,
            firstName,
            lastName,
            afiliado: afilRaw,
            nip: nipRaw,
            rawDOB: rawDOB ?? '',
          });
          rawId = afilRaw;
        }
      } else {
        rawId = nipRaw || nifRaw || cipRaw || claveRaw || '';
      }

      let idNumber: string;
      let usedFallback = false;
      let fallbackDetail: string | null = null;
      if (!rawId) {
        const key = deterministicFallbackKey(
          firstName,
          lastName,
          rawDOB || '',
          row.SEXO || '',
        );
        idNumber = `MIG-${key}`;
        usedFallback = true;
        fallbackDetail = `AFILIADO/NIP/NIF/CIP/Clave all empty; key from sha256(firstName|lastName|rawDOB|rawSex)`;
      } else {
        idNumber = rawId;
      }

      const dobParsed = correctTwoDigitDobCentury(
        parseAndFormatDate(rawDOB, args.dateFormat),
        rawDOB,
      );
      const futureDOB = isFutureOrImplausibleDOB(dobParsed.iso);

      const rawAltaDate = row.FECHA_ALTA || row.FECHA_ALTAPROFESION;
      const altaParsed = parseAndFormatDate(rawAltaDate, args.dateFormat);
      const registrationDateStr = altaParsed.iso;
      const createdAtTimestamp = new Date(registrationDateStr);

      const rawSex = row.SEXO?.trim();
      let sex: 'F' | 'M' | 'other' = DEFAULT_SEX;
      let usedDefaultSex = false;
      if (rawSex === 'M') sex = 'M';
      else if (rawSex === 'F') sex = 'F';
      else usedDefaultSex = true;

      if (usedFallback)
        fallbackIds.push({ rowIdx, identifier, value: idNumber });
      if (dobParsed.usedDefault)
        defaultDOB.push({
          rowIdx,
          identifier,
          value: rawDOB || '(empty)',
        });
      if (dobParsed.unparseable)
        unparseableDates.push({
          rowIdx,
          identifier,
          value: rawDOB || '(empty)',
        });
      if (usedDefaultSex)
        defaultSex.push({
          rowIdx,
          identifier,
          value: rawSex || '(empty)',
        });
      if (futureDOB) {
        futureDOBs.push({
          rowIdx,
          identifier,
          value: dobParsed.iso,
        });
        skipped.push({
          rowIdx,
          identifier,
          reason: `future/implausible DOB: ${dobParsed.iso} (raw=${rawDOB || '(empty)'}) — auto-skipped, not inserted`,
        });
        return;
      }

      // --- MAPPING CONSOLIDADO DE HISTORIAL CLÍNICO RELACIONAL ---
      const obsKey = Object.keys(row).find(
        (key) =>
          key.toLowerCase().startsWith('observa') ||
          key.toLowerCase().startsWith('obse'),
      );
      const originalObs = obsKey ? String(row[obsKey] ?? '').trim() : '';
      const filiacionNota = String(row.Nota ?? '').trim();

      // Rescatar las notas de Actos/EnfAct usando el código de enlace 'Clave' de este paciente
      const consultasHistoricas =
        historialClinicoMap.get(claveRaw)?.join('\n') || '';

      let noteSegments: { noteDate: string; content: string }[] = [];
      const patientNotesParts: string[] = [];
      let hasUndatedMigratedBlob = false;

      if (originalObs) {
        patientNotesParts.push(
          `Observaciones originales de filiación (HipoSEMG):\n${originalObs}`,
        );
      }

      const addExtraction = (extraction: BlobExtraction) => {
        for (const value of extraction.ignoredFutureDates) {
          futureNoteDates.push({ rowIdx, identifier, value });
        }

        if (extraction.kind === 'dated') {
          noteSegments.push(...extraction.segments);
        } else if (extraction.kind === 'undated') {
          patientNotesParts.push(MIGRATED_NOTES_PREFIX + extraction.text);
          hasUndatedMigratedBlob = true;
        }
      };

      addExtraction(
        extractNotesFromBlob(filiacionNota, 'dmy', {
          alternateFormat: 'mdy',
          maxDate: clinicToday,
        }),
      );
      addExtraction(
        extractNotesFromBlob(consultasHistoricas, args.dateFormat, {
          maxDate: clinicToday,
        }),
      );

      noteSegments = noteSegments.sort((a, b) =>
        a.noteDate.localeCompare(b.noteDate),
      );
      if (noteSegments.length > 0) patientsWithDatedClinicalNotes++;
      if (hasUndatedMigratedBlob) patientsWithMigratedNotesField++;

      const telefono = row.TELEFONO?.trim?.() || '';
      const telAux = row.TEL_AUX?.trim?.() || '';
      const domicilio = row.DOMICILIO?.trim?.() || '';
      const lunacim = row.LUNACIM?.trim?.() || '';
      const localidad = row.LOCALIDAD?.trim?.() || '';
      const provincia = row.PROVINCIA?.trim?.() || '';
      const cp = row.CP?.trim?.() || '';

      const addressParts = [domicilio, localidad, provincia, cp].filter(
        (p) => p.length > 0,
      );
      const addressCombined =
        addressParts.length > 0 ? addressParts.join(', ') : null;

      if (lunacim) {
        patientNotesParts.unshift(`Lugar de nacimiento: ${lunacim}.`);
      }

      if (afiliadoCollided) {
        patientNotesParts.unshift(
          `⚠️ DUPLICADO — cédula real (AFILIADO): ${afilRaw} — revisar para fusión manual.`,
        );
      }

      const patientNotesField =
        patientNotesParts.length > 0 ? patientNotesParts.join('\n\n') : null;

      if (lunacim) mappedLunacim.push({ rowIdx, identifier, value: lunacim });
      if (localidad)
        mappedLocalidad.push({ rowIdx, identifier, value: localidad });

      plans.push({
        rowIdx,
        identifier,
        values: {
          clinicId,
          idNumber,
          idType: 'cedula',
          firstName,
          lastName,
          dateOfBirth: dobParsed.iso,
          sex,
          phone: telefono || telAux || null,
          address: addressCombined,
          email: row.EMail?.trim() || null,
          occupation: row.PROFESION?.trim() || null,
          notes: patientNotesField,
          isActive: true,
          createdBy: authorId,
          createdAt: createdAtTimestamp,
          updatedAt: new Date(),
        },
        noteSegments,
        registrationDateStr,
      });

      mapped++;
      notesPlanned += noteSegments.length;
    } catch (err: any) {
      skipped.push({
        rowIdx,
        identifier: `#${rowIdx} ${row.NOMBRE || '(unknown)'}`,
        reason: `mapping error: ${err?.message ?? String(err)}`,
      });
    }
  });

  if (args.notesOnly) {
    console.log(
      args.dryRun
        ? '🔎 Comparando notas contra pacientes existentes (DRY-RUN, no DB writes)...\n'
        : '✍️  Insertando solo notas faltantes en pacientes existentes...\n',
    );

    const insertPlans: NotesOnlyInsertPlan[] = [];
    const existingPatients = await db
      .select({
        id: patients.id,
        idNumber: patients.idNumber,
      })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));
    const existingPatientByIdNumber = new Map(
      existingPatients.map((patient) => [patient.idNumber, patient]),
    );

    const plansWithPatients: {
      plan: PatientPlan;
      patient: { id: string; idNumber: string };
    }[] = [];

    for (const plan of plans) {
      if (plan.noteSegments.length === 0) continue;

      const existingPatient = existingPatientByIdNumber.get(
        String(plan.values.idNumber),
      );

      if (!existingPatient) {
        notesOnlyPatientsNotFound.push({
          rowIdx: plan.rowIdx,
          identifier: plan.identifier,
          value: `${String(plan.values.idNumber)} | notes=${plan.noteSegments.length}`,
        });
        notesOnlyNotesWithoutPatient += plan.noteSegments.length;
        continue;
      }

      notesOnlyPatientsMatched++;
      plansWithPatients.push({ plan, patient: existingPatient });
    }

    const existingMigratedKeysByPatientId = new Map<string, Set<string>>();
    const matchedPatientIds = Array.from(
      new Set(plansWithPatients.map(({ patient }) => patient.id)),
    );
    const chunkSize = 1000;
    for (let i = 0; i < matchedPatientIds.length; i += chunkSize) {
      const chunk = matchedPatientIds.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const existingNotes = await db
        .select({
          patientId: clinicalNotes.patientId,
          noteDate: clinicalNotes.noteDate,
          subjective: clinicalNotes.subjective,
        })
        .from(clinicalNotes)
        .where(
          and(
            inArray(clinicalNotes.patientId, chunk),
            eq(clinicalNotes.chiefComplaint, MIGRATED_CHIEF_COMPLAINT),
          ),
        );

      for (const note of existingNotes) {
        let keys = existingMigratedKeysByPatientId.get(note.patientId);
        if (!keys) {
          keys = new Set<string>();
          existingMigratedKeysByPatientId.set(note.patientId, keys);
        }
        keys.add(noteDedupeKey(String(note.noteDate), note.subjective ?? ''));
      }
    }

    for (const { plan, patient } of plansWithPatients) {
      const existingMigratedKeys =
        existingMigratedKeysByPatientId.get(patient.id) ?? new Set<string>();

      const notesToInsert = plan.noteSegments.filter((note) => {
        const key = noteDedupeKey(note.noteDate, note.content);
        if (existingMigratedKeys.has(key)) {
          notesAlreadyExisting++;
          return false;
        }
        existingMigratedKeys.add(key);
        return true;
      });

      if (notesToInsert.length > 0) {
        insertPlans.push({
          patientId: patient.id,
          notes: notesToInsert,
        });
      }
    }

    notesInserted = insertPlans.reduce(
      (sum, plan) => sum + plan.notes.length,
      0,
    );
    notesSkippedExistingPatient = notesAlreadyExisting;
    patientsMatchedExisting = notesOnlyPatientsMatched;

    if (!args.dryRun) {
      try {
        await db.transaction(async (tx) => {
          const noteRows = insertPlans.flatMap((insertPlan) =>
            insertPlan.notes.map((note) => {
              const noteTimestamp = new Date(note.noteDate);
              return {
                patientId: insertPlan.patientId,
                authorId,
                noteDate: note.noteDate,
                chiefComplaint: MIGRATED_CHIEF_COMPLAINT,
                subjective: note.content,
                objective: MIGRATED_STRUCTURED_PLACEHOLDER,
                assessment: MIGRATED_STRUCTURED_PLACEHOLDER,
                plan: MIGRATED_STRUCTURED_PLACEHOLDER,
                diagnoses: [],
                isSigned: false,
                signedAt: null,
                createdAt: noteTimestamp,
                updatedAt: noteTimestamp,
              };
            }),
          );

          const insertChunkSize = 500;
          for (let i = 0; i < noteRows.length; i += insertChunkSize) {
            await tx.insert(clinicalNotes).values(
              noteRows.slice(i, i + insertChunkSize),
            );
          }
        });
      } catch (err: any) {
        console.error(
          '\n💥 Transacción abortada — TODOS los cambios revertidos. Error:',
          err?.message ?? err,
        );
        printSummary({
          mode: 'NOTES-ONLY COMMIT (FAILED / ROLLED BACK)',
          dateFormat: args.dateFormat,
          limit: args.limit,
          totalRead,
          processed: toProcess.length,
          mapped,
          notesPlanned,
          patientsInserted,
          patientsMatchedExisting,
          notesInserted,
          notesSkippedExistingPatient,
          notesOnlyPatientsNotFound,
          notesOnlyNotesWithoutPatient,
          patientsWithDatedClinicalNotes,
          patientsWithMigratedNotesField,
          skipped,
          defaultDOB,
          defaultSex,
          unparseableDates,
          fallbackIds,
          futureDOBs,
          futureNoteDates,
          afiliadoDuplicatesSeparated,
          plans,
          collisionGroups,
          mappedLunacim,
          mappedLocalidad,
        });
        process.exit(1);
      }
    }

    printSummary({
      mode: args.dryRun
        ? 'NOTES-ONLY DRY-RUN (no DB writes)'
        : 'NOTES-ONLY COMMIT (success)',
      dateFormat: args.dateFormat,
      limit: args.limit,
      totalRead,
      processed: toProcess.length,
      mapped,
      notesPlanned,
      patientsWithDatedClinicalNotes,
      patientsWithMigratedNotesField,
      patientsInserted,
      patientsMatchedExisting,
      notesInserted,
      notesSkippedExistingPatient,
      notesOnlyPatientsNotFound,
      notesOnlyNotesWithoutPatient,
      skipped,
      defaultDOB,
      defaultSex,
      unparseableDates,
      fallbackIds,
      futureDOBs,
      futureNoteDates,
      afiliadoDuplicatesSeparated,
      collisionGroups,
      plans,
      mappedLunacim,
      mappedLocalidad,
    });

    process.exit(0);
  }

  console.log(
    args.dryRun
      ? '🔎 Comparando migración completa contra pacientes existentes (DRY-RUN, no DB writes)...\n'
      : '🔎 Preparando migración completa contra pacientes existentes...\n',
  );

  const existingPatients = await db
    .select({
      id: patients.id,
      idNumber: patients.idNumber,
    })
    .from(patients)
    .where(eq(patients.clinicId, clinicId));
  const existingPatientByIdNumber = new Map(
    existingPatients.map((patient) => [patient.idNumber, patient]),
  );

  const existingPlanMatches = plans
    .map((plan) => ({
      plan,
      patient: existingPatientByIdNumber.get(String(plan.values.idNumber)),
    }))
    .filter(
      (item): item is { plan: PatientPlan; patient: { id: string; idNumber: string } } =>
        item.patient !== undefined,
    );

  const existingMigratedKeysByPatientId = new Map<string, Set<string>>();
  const existingMatchedPatientIds = Array.from(
    new Set(existingPlanMatches.map(({ patient }) => patient.id)),
  );
  const existingNoteChunkSize = 1000;
  for (let i = 0; i < existingMatchedPatientIds.length; i += existingNoteChunkSize) {
    const chunk = existingMatchedPatientIds.slice(i, i + existingNoteChunkSize);
    if (chunk.length === 0) continue;

    const existingNotes = await db
      .select({
        patientId: clinicalNotes.patientId,
        noteDate: clinicalNotes.noteDate,
        subjective: clinicalNotes.subjective,
      })
      .from(clinicalNotes)
      .where(
        and(
          inArray(clinicalNotes.patientId, chunk),
          eq(clinicalNotes.chiefComplaint, MIGRATED_CHIEF_COMPLAINT),
        ),
      );

    for (const note of existingNotes) {
      let keys = existingMigratedKeysByPatientId.get(note.patientId);
      if (!keys) {
        keys = new Set<string>();
        existingMigratedKeysByPatientId.set(note.patientId, keys);
      }
      keys.add(noteDedupeKey(String(note.noteDate), note.subjective ?? ''));
    }
  }

  patientsMatchedExisting = existingPlanMatches.length;
  patientsInserted = plans.length - patientsMatchedExisting;
  notesInserted = 0;
  notesSkippedExistingPatient = 0;
  const noteSegmentsToInsertByPlan = new Map<
    PatientPlan,
    { noteDate: string; content: string }[]
  >();
  const seenMigratedKeysForPlanningByPatientId = new Map<string, Set<string>>();

  for (const plan of plans) {
    const existingPatient = existingPatientByIdNumber.get(
      String(plan.values.idNumber),
    );
    const existingMigratedKeys =
      existingPatient &&
      seenMigratedKeysForPlanningByPatientId.has(existingPatient.id)
        ? seenMigratedKeysForPlanningByPatientId.get(existingPatient.id)!
        : new Set(
            existingPatient
              ? existingMigratedKeysByPatientId.get(existingPatient.id) ?? []
              : [],
          );
    if (existingPatient) {
      seenMigratedKeysForPlanningByPatientId.set(
        existingPatient.id,
        existingMigratedKeys,
      );
    }

    for (const note of plan.noteSegments) {
      const key = noteDedupeKey(note.noteDate, note.content);
      if (existingMigratedKeys.has(key)) {
        notesSkippedExistingPatient++;
      } else {
        existingMigratedKeys.add(key);
        notesInserted++;
        const plannedNotes = noteSegmentsToInsertByPlan.get(plan) ?? [];
        plannedNotes.push(note);
        noteSegmentsToInsertByPlan.set(plan, plannedNotes);
      }
    }
  }

  if (!args.dryRun) {
    console.log(
      '✍️  Iniciando transacción única para escribir todos los registros...\n',
    );
    try {
      await db.transaction(async (tx) => {
        const newPatientPlans = plans.filter(
          (plan) =>
            !existingPatientByIdNumber.has(String(plan.values.idNumber)),
        );

        const patientInsertChunkSize = 500;
        for (let i = 0; i < newPatientPlans.length; i += patientInsertChunkSize) {
          const chunk = newPatientPlans.slice(i, i + patientInsertChunkSize);
          if (chunk.length === 0) continue;

          await tx
            .insert(patients)
            .values(chunk.map((plan) => plan.values))
            .onConflictDoNothing();
        }

        const planIdNumbers = plans.map((plan) => String(plan.values.idNumber));
        const patientIdByIdNumber = new Map<string, string>();
        for (let i = 0; i < planIdNumbers.length; i += existingNoteChunkSize) {
          const chunk = planIdNumbers.slice(i, i + existingNoteChunkSize);
          if (chunk.length === 0) continue;

          const rows = await tx
            .select({
              id: patients.id,
              idNumber: patients.idNumber,
            })
            .from(patients)
            .where(
              and(
                eq(patients.clinicId, clinicId),
                inArray(patients.idNumber, chunk),
              ),
            );

          for (const row of rows) {
            patientIdByIdNumber.set(row.idNumber, row.id);
          }
        }

        const noteRows = plans.flatMap((plan) => {
          const idNumber = String(plan.values.idNumber);
          const patientId = patientIdByIdNumber.get(idNumber);
          if (!patientId) {
            throw new Error(
              `Row ${plan.identifier}: patient not found after insert for idNumber=${idNumber}`,
            );
          }

          const notesToInsert =
            noteSegmentsToInsertByPlan.get(plan) ?? [];

          return notesToInsert
            .map((note) => {
              const noteTimestamp = new Date(note.noteDate);
              return {
                patientId,
                authorId,
                noteDate: note.noteDate,
                chiefComplaint: MIGRATED_CHIEF_COMPLAINT,
                subjective: note.content,
                objective: MIGRATED_STRUCTURED_PLACEHOLDER,
                assessment: MIGRATED_STRUCTURED_PLACEHOLDER,
                plan: MIGRATED_STRUCTURED_PLACEHOLDER,
                diagnoses: [],
                isSigned: false,
                signedAt: null,
                createdAt: noteTimestamp,
                updatedAt: noteTimestamp,
              };
            });
        });

        const noteInsertChunkSize = 500;
        for (let i = 0; i < noteRows.length; i += noteInsertChunkSize) {
          await tx
            .insert(clinicalNotes)
            .values(noteRows.slice(i, i + noteInsertChunkSize));
        }
      });
    } catch (err: any) {
      console.error(
        '\n💥 Transacción abortada — TODOS los cambios revertidos. Error:',
        err?.message ?? err,
      );
      printSummary({
        mode: 'COMMIT (FAILED / ROLLED BACK)',
        dateFormat: args.dateFormat,
        limit: args.limit,
        totalRead,
        processed: toProcess.length,
        mapped,
        notesPlanned,
        patientsInserted,
        patientsMatchedExisting,
        notesInserted,
        notesSkippedExistingPatient,
        notesOnlyPatientsNotFound,
        notesOnlyNotesWithoutPatient,
        patientsWithDatedClinicalNotes,
        patientsWithMigratedNotesField,
        skipped,
        defaultDOB,
        defaultSex,
        unparseableDates,
        fallbackIds,
        futureDOBs,
        futureNoteDates,
        afiliadoDuplicatesSeparated,
        plans,
        collisionGroups,
        mappedLunacim,
        mappedLocalidad,
      });
      process.exit(1);
    }
  }

  printSummary({
    mode: args.dryRun ? 'DRY-RUN (no DB writes)' : 'COMMIT (success)',
    dateFormat: args.dateFormat,
    limit: args.limit,
    totalRead,
    processed: toProcess.length,
    mapped,
    notesPlanned,
    patientsWithDatedClinicalNotes,
    patientsWithMigratedNotesField,
    patientsInserted,
    patientsMatchedExisting,
    notesInserted,
    notesSkippedExistingPatient,
    notesOnlyPatientsNotFound,
    notesOnlyNotesWithoutPatient,
    skipped,
    defaultDOB,
    defaultSex,
    unparseableDates,
    fallbackIds,
    futureDOBs,
    futureNoteDates,
    afiliadoDuplicatesSeparated,
    collisionGroups,
    plans,
    mappedLunacim,
    mappedLocalidad,
  });

  process.exit(0);
}

interface SummaryInput {
  mode: string;
  dateFormat: DateFormat;
  limit: number | null;
  totalRead: number;
  processed: number;
  mapped: number;
  notesPlanned: number;
  patientsInserted: number;
  patientsMatchedExisting: number;
  notesInserted: number;
  notesSkippedExistingPatient: number;
  notesOnlyPatientsNotFound: FlagEntry[];
  notesOnlyNotesWithoutPatient: number;
  patientsWithDatedClinicalNotes: number;
  patientsWithMigratedNotesField: number;
  skipped: SkipEntry[];
  defaultDOB: FlagEntry[];
  defaultSex: FlagEntry[];
  unparseableDates: FlagEntry[];
  fallbackIds: FlagEntry[];
  futureDOBs: FlagEntry[];
  futureNoteDates: FlagEntry[];
  afiliadoDuplicatesSeparated: number;
  collisionGroups: Map<string, AfilSeen[]>;
  plans: PatientPlan[];
  mappedLunacim: FlagEntry[];
  mappedLocalidad: FlagEntry[];
}

function printSummary(s: SummaryInput) {
  const line = '─'.repeat(64);
  console.log(`\n${line}`);
  console.log(`📊 MIGRATION SUMMARY — ${s.mode}`);
  console.log(line);
  console.log(
    `Date format used:           ${s.dateFormat.toUpperCase()} for DOB/Actos, DMY for Filiacion.Nota`,
  );
  console.log(`Row limit:                  ${s.limit ?? '(none — full file)'}`);
  console.log(`Rows read from CSV:         ${s.totalRead}`);
  console.log(`Rows processed (after limit): ${s.processed}`);
  console.log(`Successfully mapped:        ${s.mapped}`);
  console.log(`Skipped (mapping errors):   ${s.skipped.length}`);
  console.log(`Notes planned for insertion: ${s.notesPlanned}`);
  console.log(
    `Patients with dated clinical notes (per-visit rows): ${s.patientsWithDatedClinicalNotes}`,
  );
  console.log(
    `Patients with undated blob routed to patients.notes: ${s.patientsWithMigratedNotesField}`,
  );
  if (s.mode.startsWith('NOTES-ONLY')) {
    console.log(`Existing patients matched:   ${s.patientsMatchedExisting}`);
    console.log(
      `CSV patients not found locally: ${s.notesOnlyPatientsNotFound.length}`,
    );
    console.log(
      `Notes skipped because patient was not found: ${s.notesOnlyNotesWithoutPatient}`,
    );
    console.log(`Notes to insert:            ${s.notesInserted}`);
    console.log(
      `Notes already present (exact migrated duplicate): ${s.notesSkippedExistingPatient}`,
    );
  } else if (s.mode.startsWith('DRY-RUN')) {
    console.log(`Patients that would insert: ${s.patientsInserted}`);
    console.log(`Patients already existing:  ${s.patientsMatchedExisting}`);
    console.log(`Notes that would insert:    ${s.notesInserted}`);
    console.log(
      `Notes that would skip (exact migrated duplicate): ${s.notesSkippedExistingPatient}`,
    );
  } else {
    console.log(`Patients inserted:          ${s.patientsInserted}`);
    console.log(`Patients matched existing:  ${s.patientsMatchedExisting}`);
    console.log(`Notes inserted:             ${s.notesInserted}`);
    console.log(
      `Notes skipped (exact migrated duplicate): ${s.notesSkippedExistingPatient}`,
    );
  }
  console.log('');
  console.log(
    `Rows using default DOB (${DEFAULT_DOB}): ${s.defaultDOB.length}`,
  );
  console.log(
    `Rows using default sex (${DEFAULT_SEX}):       ${s.defaultSex.length}`,
  );
  console.log(
    `Rows with unparseable dates:           ${s.unparseableDates.length}`,
  );
  console.log(`Rows using a fallback ID (MIG-...):    ${s.fallbackIds.length}`);
  console.log(
    `Rows with future/implausible DOB (<1y or future): ${s.futureDOBs.length}`,
  );
  console.log(
    `Future/invalid clinical-note date markers ignored: ${s.futureNoteDates.length}`,
  );
  console.log(
    `AFILIADO duplicates imported as separate records (NIP/NIF/CIP/MIG fallback): ${s.afiliadoDuplicatesSeparated} (across ${s.collisionGroups.size} distinct AFILIADO groups) — flagged in patients.notes for manual fusion`,
  );
  console.log(
    `Rows with LUNACIM (place of birth) — prepended to patient.notes: ${s.mappedLunacim.length}`,
  );
  console.log(
    `Rows with LOCALIDAD (city) — folded into patient.address:        ${s.mappedLocalidad.length}`,
  );

  const dump = (title: string, rows: FlagEntry[] | SkipEntry[]) => {
    if (rows.length === 0) return;
    console.log(`\n${title} (${rows.length}):`);
    for (const r of rows.slice(0, 50)) {
      if ('reason' in r) {
        console.log(`  - ${r.identifier} :: ${r.reason}`);
      } else {
        console.log(`  - ${r.identifier} :: ${r.value}`);
      }
    }
    if (rows.length > 50) console.log(`  … (+${rows.length - 50} more)`);
  };

  dump('⚠️  Skipped rows', s.skipped);
  dump('📅 Default DOB used', s.defaultDOB);
  dump('⚧  Default sex used', s.defaultSex);
  dump('📆 Unparseable dates', s.unparseableDates);
  dump('🆔 Fallback IDs (deterministic hash)', s.fallbackIds);
  dump('🚨 Future / implausible DOB (REVIEW BEFORE COMMIT)', s.futureDOBs);
  dump('🚨 Future/invalid clinical-note dates ignored', s.futureNoteDates);
  dump('🔎 NOTES-ONLY patients not found by idNumber', s.notesOnlyPatientsNotFound);
  dump(
    '📍 LUNACIM (place of birth) — prepended to patient.notes',
    s.mappedLunacim,
  );
  dump('🏙  LOCALIDAD (city) — folded into patient.address', s.mappedLocalidad);

  if (s.collisionGroups.size > 0) {
    console.log(
      `\n🔁 AFILIADO duplicate groups (${s.collisionGroups.size}) — imported as separate records, flagged for manual fusion in the UI:`,
    );
    const planByRowIdx = new Map<number, PatientPlan>();
    for (const p of s.plans) planByRowIdx.set(p.rowIdx, p);

    const sortedGroups = Array.from(s.collisionGroups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    for (const [afil, members] of sortedGroups) {
      console.log(`\n   AFILIADO=${afil}  (${members.length} rows)`);
      console.log(
        `   ${'row#'.padEnd(6)} ${'role'.padEnd(14)} ${'name'.padEnd(40)} ${'final idNumber'.padEnd(20)} ${'NIP'.padEnd(16)} ${'DOB (raw)'.padEnd(14)}`,
      );
      members.forEach((m, idx) => {
        const role = idx === 0 ? 'keeps AFIL' : 'fallback→';
        const name = `${m.firstName} ${m.lastName}`.slice(0, 40);
        const mPlan = planByRowIdx.get(m.rowIdx);
        const finalId = mPlan?.values.idNumber ?? '(skipped)';
        console.log(
          `   ${`#${m.rowIdx}`.padEnd(6)} ${role.padEnd(14)} ${name.padEnd(40)} ${String(finalId).padEnd(20)} ${(m.nip || '(empty)').padEnd(16)} ${(m.rawDOB || '(empty)').padEnd(14)}`,
        );
      });
    }

    interface NotesLoss {
      groupAfiliado: string;
      rowIdxA: number;
      rowIdxB: number;
      sharedIdNumber: string;
    }
    const notesLosses: NotesLoss[] = [];

    for (const [afil, members] of s.collisionGroups) {
      const idToRowIdx = new Map<string, number>();
      for (const m of members) {
        const mPlan = planByRowIdx.get(m.rowIdx);
        if (!mPlan) continue;
        const id = String(mPlan.values.idNumber);
        const existing = idToRowIdx.get(id);
        if (existing !== undefined) {
          notesLosses.push({
            groupAfiliado: afil,
            rowIdxA: existing,
            rowIdxB: m.rowIdx,
            sharedIdNumber: id,
          });
        } else {
          idToRowIdx.set(id, m.rowIdx);
        }
      }
    }

    console.log(
      `\n🩺 Notes-loss detector — collision-group rows sharing a final idNumber: ${notesLosses.length}`,
    );
    if (notesLosses.length === 0) {
      console.log(
        `   ✅ Every duplicate-group row resolved to a distinct idNumber via NIP/NIF/CIP/MIG fallback — no merge will occur, all notes preserved.`,
      );
    } else {
      console.log(
        `   ⚠️  These pairs would still collapse on insert (same final idNumber). Review before --commit:`,
      );
      for (const loss of notesLosses.slice(0, 50)) {
        console.log(
          `   - AFILIADO=${loss.groupAfiliado}: rows #${loss.rowIdxA} and #${loss.rowIdxB} both resolved to idNumber=${loss.sharedIdNumber}`,
        );
      }
      if (notesLosses.length > 50) {
        console.log(`   … (+${notesLosses.length - 50} more)`);
      }
    }
  }

  console.log(`\n${line}`);
  if (s.mode.startsWith('DRY-RUN')) {
    console.log(
      'ℹ️  This was a DRY-RUN. No data was written. Re-run with --commit to persist.',
    );
  }
  console.log(line + '\n');
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
