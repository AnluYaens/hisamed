import { db } from "../src/lib/db";
import { users, patients, clinicalNotes } from "../src/lib/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import crypto from "crypto";

const CSV_FILE_PATH = path.join(process.cwd(), "FILIACION.csv");

const DEFAULT_DOB = "1970-01-01";
const DEFAULT_SEX: "F" | "M" | "other" = "F";

type DateFormat = "mdy" | "dmy";

interface CliArgs {
  targetDoctorEmail: string;
  dryRun: boolean;
  limit: number | null;
  dateFormat: DateFormat;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let targetDoctorEmail = "";
  let commit = false;
  let limit: number | null = null;
  let dateFormat: DateFormat = "mdy";
  let verbose = false;

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--commit") {
      commit = true;
    } else if (a === "--dry-run") {
      commit = false;
    } else if (a === "--verbose") {
      verbose = true;
    } else if (a === "--limit") {
      const n = parseInt(argv[++i], 10);
      if (isNaN(n) || n <= 0) {
        console.error("❌ --limit requires a positive integer.");
        process.exit(1);
      }
      limit = n;
    } else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (isNaN(n) || n <= 0) {
        console.error("❌ --limit requires a positive integer.");
        process.exit(1);
      }
      limit = n;
    } else if (a === "--date-format") {
      const v = argv[++i];
      if (v !== "mdy" && v !== "dmy") {
        console.error("❌ --date-format must be 'mdy' or 'dmy'.");
        process.exit(1);
      }
      dateFormat = v;
    } else if (a.startsWith("--date-format=")) {
      const v = a.slice("--date-format=".length);
      if (v !== "mdy" && v !== "dmy") {
        console.error("❌ --date-format must be 'mdy' or 'dmy'.");
        process.exit(1);
      }
      dateFormat = v;
    } else if (!a.startsWith("--")) {
      positional.push(a);
    } else {
      console.error(`❌ Unknown flag: ${a}`);
      process.exit(1);
    }
  }

  targetDoctorEmail = positional[0] ?? "";
  return { targetDoctorEmail, dryRun: !commit, limit, dateFormat, verbose };
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
  sex: "F" | "M" | "other";
  usedDefaultSex: boolean;
  rawSex: string;
  idNumber: string;
  usedFallback: boolean;
  fallbackDetail: string | null;
  notesRouting: string;
  flags: string[];
}) {
  const line = "─".repeat(64);
  console.log(line);
  console.log(`Row #${opts.rowIdx}`);
  console.log(
    `  Source name:   NOMBRE="${opts.rawNombre}" APELLIDO1="${opts.rawApellido1}" APELLIDO2="${opts.rawApellido2}"`,
  );
  console.log(
    `  Mapped name:   firstName="${opts.firstName}" lastName="${opts.lastName}"`,
  );
  console.log(
    `  DOB:           "${opts.rawDOB || "(empty)"}" → ${opts.parsedDOB}`,
  );
  console.log(
    `  Sex:           ${opts.sex}${opts.usedDefaultSex ? ` (defaulted — raw="${opts.rawSex || "(empty)"}")` : ` (from raw="${opts.rawSex}")`}`,
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
    `  Flags:         ${opts.flags.length ? opts.flags.join(", ") : "(none)"}`,
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
  if (!dateStr || dateStr.trim() === "") {
    return {
      iso: DEFAULT_DOB,
      usedDefault: true,
      unparseable: false,
      futureOrImplausible: false,
    };
  }

  const cleanStr = dateStr.replace(/\//g, "-").trim();
  const parts = cleanStr.split("-");

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
      if (format === "mdy") {
        month = first;
        day = second;
        // Contingency: swap if first is clearly a day (>12) and second fits a month.
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
        const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return {
          iso,
          usedDefault: false,
          unparseable: false,
          futureOrImplausible: false,
        };
      }
    }
  }

  // Fallback ISO parse.
  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return false;
  const oneYearAgo = new Date(TODAY);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  return d > oneYearAgo;
}

function deterministicFallbackKey(
  firstName: string,
  lastName: string,
  rawDOB: string,
  rawSex: string,
): string {
  const h = crypto
    .createHash("sha256")
    .update(
      [firstName, lastName, rawDOB, rawSex]
        .map((s) => (s ?? "").trim().toUpperCase())
        .join("|"),
    )
    .digest("hex");
  return h.slice(0, 12);
}

type BlobExtraction =
  | { kind: "empty" }
  | { kind: "undated"; text: string }
  | { kind: "dated"; segments: { noteDate: string; content: string }[] };

function extractNotesFromBlob(
  blobText: string,
  format: DateFormat,
): BlobExtraction {
  if (!blobText || blobText.trim() === "") return { kind: "empty" };

  const dateRegex = /(?:^|\n)(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})[\s,.:]+/g;

  const segments: { noteDate: string; content: string }[] = [];
  const matches: { index: number; dateStr: string; matchLength: number }[] = [];
  let match;

  while ((match = dateRegex.exec(blobText)) !== null) {
    let first = parseInt(match[1], 10);
    let second = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);

    if (year < 100) year += year > 50 ? 1900 : 2000;

    let month: number;
    let day: number;
    if (format === "mdy") {
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

    const formattedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    matches.push({
      index: match.index,
      dateStr: formattedDate,
      matchLength: match[0].length,
    });
  }

  if (matches.length === 0) {
    return { kind: "undated", text: blobText.trim() };
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startText = current.index + current.matchLength;
    const endText =
      i + 1 < matches.length ? matches[i + 1].index : blobText.length;

    const textContent = blobText.substring(startText, endText).trim();
    if (textContent.length > 0) {
      segments.push({
        noteDate: current.dateStr,
        content: textContent,
      });
    }
  }

  if (segments.length === 0) return { kind: "empty" };
  return { kind: "dated", segments };
}

const MIGRATED_NOTES_PREFIX = "Historial migrado (HipoSEMG): ";

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.targetDoctorEmail) {
    console.error(
      "\n❌ Error: No especificaste la clínica destino para la migración.",
    );
    console.error(
      "💡 Uso: pnpm tsx scripts/migrate-hiposeme.ts <email_doctor> [--commit] [--limit N] [--date-format mdy|dmy] [--verbose]",
    );
    console.error(
      "      Por defecto corre en DRY-RUN. Usa --commit para escribir realmente.\n",
    );
    process.exit(1);
  }

  const mode = args.dryRun ? "DRY-RUN (no DB writes)" : "COMMIT (writes will persist)";
  console.log(`\n🛡️  Modo: ${mode}`);
  console.log(`📅 Date format (DOB + nota): ${args.dateFormat.toUpperCase()}`);
  if (args.limit !== null) console.log(`🔬 Limit: ${args.limit} filas`);
  if (args.verbose) console.log(`🔍 Verbose: on (per-row detail)`);
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

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ No se encontró 'FILIACION.csv' en: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  const rows: any[] = await new Promise((resolve, reject) => {
    const out: any[] = [];
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv({ quote: '"', escape: '"' }))
      .on("data", (data) => {
        if (data.NOMBRE || data.APELLIDO1 || data.ClaveNIP || data.Filiacion) {
          out.push(data);
        }
      })
      .on("end", () => resolve(out))
      .on("error", reject);
  });

  const totalRead = rows.length;
  const toProcess = args.limit !== null ? rows.slice(0, args.limit) : rows;
  console.log(
    `📦 Filas leídas: ${totalRead}. A procesar: ${toProcess.length}.\n`,
  );

  // Counters / report buckets.
  let mapped = 0;
  let notesPlanned = 0;
  let patientsInserted = 0;
  let patientsMatchedExisting = 0;
  let notesInserted = 0;
  let notesSkippedExistingPatient = 0;
  let patientsWithDatedClinicalNotes = 0;
  let patientsWithMigratedNotesField = 0;
  const skipped: SkipEntry[] = [];
  const defaultDOB: FlagEntry[] = [];
  const defaultSex: FlagEntry[] = [];
  const unparseableDates: FlagEntry[] = [];
  const fallbackIds: FlagEntry[] = [];
  const futureDOBs: FlagEntry[] = [];
  // Tracked even though both now have a home: LUNACIM is prepended to
  // patient.notes; LOCALIDAD is folded into patient.address alongside
  // DOMICILIO/PROVINCIA/CP. Counts let you verify what was mapped vs.
  // what was empty.
  const mappedLunacim: FlagEntry[] = [];
  const mappedLocalidad: FlagEntry[] = [];

  // AFILIADO collision tracking. The data owner confirmed these are TRUE
  // duplicates (source program crashed mid-entry; same patient re-created
  // under the same cédula). BUT auto-merge is unsafe — in several groups the
  // correct record and the good notes live in the SECOND row, so "first row
  // wins" would keep the wrong one. Repeats fall back to NIP → NIF → CIP →
  // MIG-hash for idNumber so each row imports as its own patient with all
  // notes intact; the duplicate is flagged in patients.notes for manual
  // fusion in the UI.
  const seenAfiliados = new Map<string, AfilSeen>();
  const collisionGroups = new Map<string, AfilSeen[]>();
  let afiliadoDuplicatesSeparated = 0;

  // Build the per-row plan first (pure, no DB writes). Then execute under a
  // single transaction (or skip the writes entirely in dry-run).
  const plans: PatientPlan[] = [];

  toProcess.forEach((row, idx) => {
    const rowIdx = idx + 1; // 1-based for humans
    try {
      const firstName = row.NOMBRE?.trim() || "Sin Nombre";
      const lastName =
        `${row.APELLIDO1?.trim() || ""} ${row.APELLIDO2?.trim() || ""}`.trim() ||
        "Sin Apellido";
      const identifier = `#${rowIdx} ${firstName} ${lastName}`;

      const cleanIdField = (v: any): string =>
        v == null ? "" : v.toString().replace(/,/g, "").trim();

      const afilRaw = cleanIdField(row.AFILIADO);
      const nipRaw = cleanIdField(row.NIP);
      const nifRaw = cleanIdField(row.NIF);
      const cipRaw = cleanIdField(row.CIP);
      const claveNIPRaw = cleanIdField(row.ClaveNIP);
      const filiacionRaw = cleanIdField(row.Filiacion);
      const rawDOB = row.FENAC;

      let rawId: string;
      let afiliadoCollided = false;

      if (afilRaw) {
        const prior = seenAfiliados.get(afilRaw);
        if (prior) {
          // Repeat AFILIADO in this run. Confirmed true duplicates, but the
          // "correct" record isn't always the first occurrence — auto-merging
          // would silently drop the good notes on some groups. Instead, fall
          // back to NIP → NIF → CIP → MIG-hash so this row imports as its own
          // patient with notes intact; flagged in patients.notes for manual
          // fusion in the UI. Group is still recorded for the side-by-side
          // report.
          afiliadoCollided = true;
          afiliadoDuplicatesSeparated++;
          const currentInfo: AfilSeen = {
            rowIdx,
            identifier,
            firstName,
            lastName,
            afiliado: afilRaw,
            nip: nipRaw,
            rawDOB: rawDOB ?? "",
          };
          let group = collisionGroups.get(afilRaw);
          if (!group) {
            group = [prior];
            collisionGroups.set(afilRaw, group);
          }
          group.push(currentInfo);
          rawId =
            nipRaw || nifRaw || cipRaw || claveNIPRaw || filiacionRaw || "";
        } else {
          seenAfiliados.set(afilRaw, {
            rowIdx,
            identifier,
            firstName,
            lastName,
            afiliado: afilRaw,
            nip: nipRaw,
            rawDOB: rawDOB ?? "",
          });
          rawId = afilRaw;
        }
      } else {
        rawId =
          nipRaw || nifRaw || cipRaw || claveNIPRaw || filiacionRaw || "";
      }

      let idNumber: string;
      let usedFallback = false;
      let fallbackDetail: string | null = null;
      if (!rawId) {
        const key = deterministicFallbackKey(
          firstName,
          lastName,
          rawDOB || "",
          row.SEXO || "",
        );
        idNumber = `MIG-${key}`;
        usedFallback = true;
        fallbackDetail = `AFILIADO/NIP/NIF/CIP/ClaveNIP/Filiacion all empty; key from sha256(firstName|lastName|rawDOB|rawSex)`;
      } else {
        idNumber = rawId;
      }

      const dobParsed = parseAndFormatDate(rawDOB, args.dateFormat);
      const futureDOB = isFutureOrImplausibleDOB(dobParsed.iso);

      const rawAltaDate =
        row.FECHA_ALTAPROFESION || row.FECHA_ALTAMUTUA || row.FECHA_ALTA;
      const altaParsed = parseAndFormatDate(rawAltaDate, args.dateFormat);
      const registrationDateStr = altaParsed.iso;
      const createdAtTimestamp = new Date(registrationDateStr);

      const rawSex = row.SEXO?.trim();
      let sex: "F" | "M" | "other" = DEFAULT_SEX;
      let usedDefaultSex = false;
      if (rawSex === "M") sex = "M";
      else if (rawSex === "F") sex = "F";
      else usedDefaultSex = true;

      // Record flags
      if (usedFallback) fallbackIds.push({ rowIdx, identifier, value: idNumber });
      if (dobParsed.usedDefault)
        defaultDOB.push({
          rowIdx,
          identifier,
          value: rawDOB || "(empty)",
        });
      if (dobParsed.unparseable)
        unparseableDates.push({
          rowIdx,
          identifier,
          value: rawDOB || "(empty)",
        });
      if (usedDefaultSex)
        defaultSex.push({
          rowIdx,
          identifier,
          value: rawSex || "(empty)",
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
          reason: `future/implausible DOB: ${dobParsed.iso} (raw=${rawDOB || "(empty)"}) — auto-skipped, not inserted`,
        });
        if (args.verbose) {
          const flags: string[] = ["future/implausible DOB (SKIPPED)"];
          if (usedFallback) flags.push("fallback idNumber");
          if (dobParsed.usedDefault) flags.push("default DOB");
          if (dobParsed.unparseable) flags.push("unparseable DOB");
          if (usedDefaultSex) flags.push("default sex");
          if (afiliadoCollided)
            flags.push(
              `AFILIADO duplicate → imported separately via NIP/NIF/CIP/MIG fallback`,
            );
          printVerboseRow({
            rowIdx,
            rawNombre: row.NOMBRE ?? "",
            rawApellido1: row.APELLIDO1 ?? "",
            rawApellido2: row.APELLIDO2 ?? "",
            firstName,
            lastName,
            rawDOB: rawDOB ?? "",
            parsedDOB: dobParsed.iso,
            sex,
            usedDefaultSex,
            rawSex: rawSex ?? "",
            idNumber,
            usedFallback,
            fallbackDetail,
            notesRouting: "(skipped — future DOB; not processed)",
            flags,
          });
        }
        return;
      }

      const obsKey = Object.keys(row).find(
        (key) =>
          key.toLowerCase().startsWith("observa") ||
          key.toLowerCase().startsWith("obse"),
      );
      const observationsBlob = obsKey ? row[obsKey] : "";
      const extraction = extractNotesFromBlob(observationsBlob, args.dateFormat);

      let noteSegments: { noteDate: string; content: string }[] = [];
      let patientNotesField: string | null = null;

      if (extraction.kind === "dated") {
        noteSegments = extraction.segments;
        patientsWithDatedClinicalNotes++;
      } else if (extraction.kind === "undated") {
        patientNotesField = MIGRATED_NOTES_PREFIX + extraction.text;
        patientsWithMigratedNotesField++;
      }

      const telefono = row.TELEFONO?.trim?.() || "";
      const telAux = row.TEL_AUX?.trim?.() || "";
      const domicilio = row.DOMICILIO?.trim?.() || "";
      const lunacim = row.LUNACIM?.trim?.() || "";
      const localidad = row.LOCALIDAD?.trim?.() || "";
      const provincia = row.PROVINCIA?.trim?.() || "";
      const cp = row.CP?.trim?.() || "";

      // Address consolidation: DOMICILIO, LOCALIDAD, PROVINCIA, CP in that
      // order, comma-joined, skipping empties cleanly (no leading/trailing
      // commas, no ", ," gaps).
      const addressParts = [domicilio, localidad, provincia, cp].filter(
        (p) => p.length > 0,
      );
      const addressCombined =
        addressParts.length > 0 ? addressParts.join(", ") : null;

      // LUNACIM (place of birth) → prepended to notes. Combines cleanly
      // with any "Historial migrado (HipoSEMG): …" content already routed
      // to patientNotesField. Schema has no dedicated birthplace column.
      if (lunacim) {
        const prefix = `Lugar de nacimiento: ${lunacim}. `;
        patientNotesField = (
          prefix + (patientNotesField ?? "")
        ).trimEnd();
      }

      // Duplicate marker: only on rows that hit the AFILIADO-collision
      // fallback path. The real cédula stays visible in the note so the user
      // can locate the partner record and fuse them in the UI.
      if (afiliadoCollided) {
        const dupPrefix = `⚠️ DUPLICADO — cédula real (AFILIADO): ${afilRaw} — revisar para fusión manual. `;
        patientNotesField = (dupPrefix + (patientNotesField ?? "")).trimEnd();
      }

      // Track non-empty source rows for both LUNACIM and LOCALIDAD so the
      // summary can show what got mapped vs. what was empty. These are no
      // longer "dropped" — LUNACIM is in notes; LOCALIDAD is in address.
      if (lunacim)
        mappedLunacim.push({ rowIdx, identifier, value: lunacim });
      if (localidad)
        mappedLocalidad.push({ rowIdx, identifier, value: localidad });

      plans.push({
        rowIdx,
        identifier,
        values: {
          clinicId,
          idNumber,
          idType: "cedula",
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

      if (args.verbose) {
        let notesRouting: string;
        if (extraction.kind === "dated") {
          notesRouting = `dated clinical notes (${extraction.segments.length} segment${extraction.segments.length === 1 ? "" : "s"})`;
        } else if (extraction.kind === "undated") {
          notesRouting = "undated → patients.notes";
        } else {
          notesRouting = "none";
        }
        const flags: string[] = [];
        if (dobParsed.usedDefault) flags.push("default DOB");
        if (dobParsed.unparseable) flags.push("unparseable DOB");
        if (usedDefaultSex) flags.push("default sex");
        if (usedFallback) flags.push("fallback idNumber");
        if (afiliadoCollided)
          flags.push(
            `AFILIADO duplicate → imported separately via NIP/NIF/CIP/MIG fallback`,
          );
        printVerboseRow({
          rowIdx,
          rawNombre: row.NOMBRE ?? "",
          rawApellido1: row.APELLIDO1 ?? "",
          rawApellido2: row.APELLIDO2 ?? "",
          firstName,
          lastName,
          rawDOB: rawDOB ?? "",
          parsedDOB: dobParsed.iso,
          sex,
          usedDefaultSex,
          rawSex: rawSex ?? "",
          idNumber,
          usedFallback,
          fallbackDetail,
          notesRouting,
          flags,
        });
      }
    } catch (err: any) {
      skipped.push({
        rowIdx,
        identifier: `#${rowIdx} ${row.NOMBRE || "(unknown)"}`,
        reason: `mapping error: ${err?.message ?? String(err)}`,
      });
    }
  });

  // Execute writes inside a single transaction. If anything throws, the whole
  // batch rolls back — no mixed-state DB.
  if (!args.dryRun) {
    console.log("✍️  Iniciando transacción única para escribir todos los registros...\n");
    try {
      await db.transaction(async (tx) => {
        for (const plan of plans) {
          const [inserted] = await tx
            .insert(patients)
            .values(plan.values)
            .onConflictDoNothing()
            .returning();

          let patientId: string;
          if (inserted) {
            patientId = inserted.id;
            patientsInserted++;
          } else {
            const existing = await tx.query.patients.findFirst({
              where: and(
                eq(patients.clinicId, clinicId),
                eq(patients.idNumber, plan.values.idNumber!),
              ),
            });
            if (!existing) {
              throw new Error(
                `Row ${plan.identifier}: conflict but no matching row found for idNumber=${plan.values.idNumber}`,
              );
            }
            patientId = existing.id;
            patientsMatchedExisting++;

            // Idempotency for notes: if this patient already has clinical
            // notes, skip seeding to avoid duplicating history on re-run.
            const existingNote = await tx.query.clinicalNotes.findFirst({
              where: eq(clinicalNotes.patientId, patientId),
            });
            if (existingNote) {
              notesSkippedExistingPatient += plan.noteSegments.length;
              continue;
            }
          }

          for (const note of plan.noteSegments) {
            const noteTimestamp = new Date(note.noteDate);
            await tx.insert(clinicalNotes).values({
              patientId,
              authorId,
              noteDate: note.noteDate,
              chiefComplaint: "Historial migrado (HipoSEMG)",
              subjective: note.content,
              objective:
                "Registro histórico migrado del sistema anterior (HipoSEMG). Sin detalle clínico estructurado.",
              assessment:
                "Registro histórico migrado del sistema anterior (HipoSEMG). Sin detalle clínico estructurado.",
              plan: "Registro histórico migrado del sistema anterior (HipoSEMG). Sin detalle clínico estructurado.",
              diagnoses: [],
              isSigned: false,
              signedAt: null,
              createdAt: noteTimestamp,
              updatedAt: noteTimestamp,
            });
            notesInserted++;
          }
        }
      });
    } catch (err: any) {
      console.error(
        "\n💥 Transacción abortada — TODOS los cambios revertidos. Error:",
        err?.message ?? err,
      );
      printSummary({
        mode: "COMMIT (FAILED / ROLLED BACK)",
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
        patientsWithDatedClinicalNotes,
        patientsWithMigratedNotesField,
        skipped,
        defaultDOB,
        defaultSex,
        unparseableDates,
        fallbackIds,
        futureDOBs,
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
    mode: args.dryRun ? "DRY-RUN (no DB writes)" : "COMMIT (success)",
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
    skipped,
    defaultDOB,
    defaultSex,
    unparseableDates,
    fallbackIds,
    futureDOBs,
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
  patientsWithDatedClinicalNotes: number;
  patientsWithMigratedNotesField: number;
  skipped: SkipEntry[];
  defaultDOB: FlagEntry[];
  defaultSex: FlagEntry[];
  unparseableDates: FlagEntry[];
  fallbackIds: FlagEntry[];
  futureDOBs: FlagEntry[];
  afiliadoDuplicatesSeparated: number;
  collisionGroups: Map<string, AfilSeen[]>;
  plans: PatientPlan[];
  mappedLunacim: FlagEntry[];
  mappedLocalidad: FlagEntry[];
}

function printSummary(s: SummaryInput) {
  const line = "─".repeat(64);
  console.log(`\n${line}`);
  console.log(`📊 MIGRATION SUMMARY — ${s.mode}`);
  console.log(line);
  console.log(`Date format used:           ${s.dateFormat.toUpperCase()} (default unless --date-format passed)`);
  console.log(`Row limit:                  ${s.limit ?? "(none — full file)"}`);
  console.log(`Rows read from CSV:         ${s.totalRead}`);
  console.log(`Rows processed (after limit): ${s.processed}`);
  console.log(`Successfully mapped:        ${s.mapped}`);
  console.log(`Skipped (mapping errors):   ${s.skipped.length}`);
  console.log(`Notes planned for insertion: ${s.notesPlanned}`);
  console.log(`Patients with dated clinical notes (per-visit rows): ${s.patientsWithDatedClinicalNotes}`);
  console.log(`Patients with undated blob routed to patients.notes: ${s.patientsWithMigratedNotesField}`);
  if (!s.mode.startsWith("DRY-RUN")) {
    console.log(`Patients inserted:          ${s.patientsInserted}`);
    console.log(`Patients matched existing:  ${s.patientsMatchedExisting}`);
    console.log(`Notes inserted:             ${s.notesInserted}`);
    console.log(`Notes skipped (existing patient already had notes): ${s.notesSkippedExistingPatient}`);
  }
  console.log("");
  console.log(`Rows using default DOB (${DEFAULT_DOB}): ${s.defaultDOB.length}`);
  console.log(`Rows using default sex (${DEFAULT_SEX}):       ${s.defaultSex.length}`);
  console.log(`Rows with unparseable dates:           ${s.unparseableDates.length}`);
  console.log(`Rows using a fallback ID (MIG-...):    ${s.fallbackIds.length}`);
  console.log(`Rows with future/implausible DOB (<1y or future): ${s.futureDOBs.length}`);
  console.log(`AFILIADO duplicates imported as separate records (NIP/NIF/CIP/MIG fallback): ${s.afiliadoDuplicatesSeparated} (across ${s.collisionGroups.size} distinct AFILIADO groups) — flagged in patients.notes for manual fusion`);
  console.log(`Rows with LUNACIM (place of birth) — prepended to patient.notes: ${s.mappedLunacim.length}`);
  console.log(`Rows with LOCALIDAD (city) — folded into patient.address:        ${s.mappedLocalidad.length}`);

  const dump = (title: string, rows: FlagEntry[] | SkipEntry[]) => {
    if (rows.length === 0) return;
    console.log(`\n${title} (${rows.length}):`);
    for (const r of rows.slice(0, 50)) {
      if ("reason" in r) {
        console.log(`  - ${r.identifier} :: ${r.reason}`);
      } else {
        console.log(`  - ${r.identifier} :: ${r.value}`);
      }
    }
    if (rows.length > 50) console.log(`  … (+${rows.length - 50} more)`);
  };

  dump("⚠️  Skipped rows", s.skipped);
  dump("📅 Default DOB used", s.defaultDOB);
  dump("⚧  Default sex used", s.defaultSex);
  dump("📆 Unparseable dates", s.unparseableDates);
  dump("🆔 Fallback IDs (deterministic hash)", s.fallbackIds);
  dump("🚨 Future / implausible DOB (REVIEW BEFORE COMMIT)", s.futureDOBs);
  dump("📍 LUNACIM (place of birth) — prepended to patient.notes", s.mappedLunacim);
  dump("🏙  LOCALIDAD (city) — folded into patient.address", s.mappedLocalidad);

  // AFILIADO duplicate groups — side-by-side rows so the data owner can see
  // which rows shared a cédula and will need manual fusion in the UI. Each
  // row in a group is imported as its OWN patient (idNumber falls back to
  // NIP/NIF/CIP/MIG-hash on the collision rows), with patients.notes
  // prefixed by ⚠️ DUPLICADO so the partner record is easy to locate.
  if (s.collisionGroups.size > 0) {
    console.log(
      `\n🔁 AFILIADO duplicate groups (${s.collisionGroups.size}) — imported as separate records, flagged for manual fusion in the UI:`,
    );
    console.log(
      `   Each group lists every row sharing the same AFILIADO. All rows import; the cédula appears once as idNumber (first occurrence) and once per subsequent row via NIP/NIF/CIP/MIG fallback.`,
    );
    const planByRowIdx = new Map<number, PatientPlan>();
    for (const p of s.plans) planByRowIdx.set(p.rowIdx, p);

    const sortedGroups = Array.from(s.collisionGroups.entries()).sort(
      (a, b) => a[0].localeCompare(b[0]),
    );
    for (const [afil, members] of sortedGroups) {
      console.log(`\n   AFILIADO=${afil}  (${members.length} rows)`);
      console.log(
        `   ${"row#".padEnd(6)} ${"role".padEnd(14)} ${"name".padEnd(40)} ${"final idNumber".padEnd(20)} ${"NIP".padEnd(16)} ${"DOB (raw)".padEnd(14)}`,
      );
      members.forEach((m, idx) => {
        const role = idx === 0 ? "keeps AFIL" : "fallback→";
        const name = `${m.firstName} ${m.lastName}`.slice(0, 40);
        const mPlan = planByRowIdx.get(m.rowIdx);
        const finalId = mPlan?.values.idNumber ?? "(skipped)";
        console.log(
          `   ${`#${m.rowIdx}`.padEnd(6)} ${role.padEnd(14)} ${name.padEnd(40)} ${String(finalId).padEnd(20)} ${(m.nip || "(empty)").padEnd(16)} ${(m.rawDOB || "(empty)").padEnd(14)}`,
        );
      });
    }

    // Notes-loss detection: with rows imported separately, the only way
    // notes can be lost is if two members of the same group resolve to the
    // SAME idNumber (which would collapse them via onConflictDoNothing).
    // Expected to be 0 — fallback chain NIP → NIF → CIP → MIG-hash should
    // yield a distinct idNumber per row. Anything > 0 here means a real
    // value-space collision and needs human review before --commit.
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
        if (!mPlan) continue; // row was skipped (e.g. future DOB)
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
  if (s.mode.startsWith("DRY-RUN")) {
    console.log("ℹ️  This was a DRY-RUN. No data was written. Re-run with --commit to persist.");
  }
  console.log(line + "\n");
}

main().catch((err) => {
  console.error("💥 Fatal:", err);
  process.exit(1);
});
