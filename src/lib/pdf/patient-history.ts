// Server-side PDF generation for the full patient clinical history export.
//
// Uses pdfkit because it produces real PDF bytes in Node.js without spawning
// Chromium and without bundling React, and its built-in Helvetica font
// covers Spanish accented characters. The route handler is the only caller.
//
// IMPORTANT: pdfkit is configured as a `serverExternalPackage` in
// next.config.ts so its bundled AFM font files resolve at runtime.

import PDFDocument from 'pdfkit';
import {
  CLINICAL_DOCUMENT_TYPE_LABELS,
  type ClinicalDocumentType,
} from '@/lib/validators/clinical-document';
import { formatDateEs } from '@/lib/obstetric';
import type {
  PatientHistoryAttachment,
  PatientHistoryDocument,
  PatientHistoryMedicalHistory,
  PatientHistoryNote,
  PatientHistoryPartner,
  PatientHistoryPatient,
  PatientHistoryPayload,
  PatientHistoryVitalSigns,
} from '@/queries/export-history';
import type { GynecologicalExam, Ultrasound } from '@/lib/validators/clinical-note';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEX_LABELS: Record<string, string> = {
  F: 'Femenino',
  M: 'Masculino',
  other: 'Otro',
};

const ID_TYPE_LABELS: Record<string, string> = {
  cedula: 'C.I.',
  passport: 'Pasaporte',
  other: 'Identificación',
};

const CYCLE_REGULARITY_LABELS: Record<string, string> = {
  regular: 'Regular',
  irregular: 'Irregular',
  amenorrhea: 'Amenorrea',
};

const CONTRACEPTIVE_LABELS: Record<string, string> = {
  none: 'Ninguno',
  oral: 'Anticonceptivo oral',
  iud: 'DIU',
  implant: 'Implante',
  barrier: 'Método de barrera',
  other: 'Otro',
};

const ATTACHMENT_CATEGORY_LABELS: Record<string, string> = {
  lab_result: 'Resultado de laboratorio',
  imaging: 'Imagen',
  consent: 'Consentimiento',
  prescription: 'Récipe',
  procedure_photo: 'Foto de procedimiento',
  ultrasound: 'Ecografía',
  other: 'Otro',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAge(dob: string, timeZone: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  // Derive today's calendar date in the clinic's timezone — not the server's
  // UTC clock — so age stays stable around birthdays regardless of host TZ.
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

function fmtDateTimeEs(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function fmtDateLongEs(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function nonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function safeFilenamePart(value: string): string {
  // Strip diacritics, then keep only [A-Za-z0-9-] joined by single dashes so
  // the filename header value stays inside the RFC 6266 safe charset.
  const noAccents = value.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (
    noAccents
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'paciente'
  );
}

export function exportHistoryFilename(patient: {
  firstName: string;
  lastName: string;
}): string {
  return `historia-clinica-${safeFilenamePart(
    `${patient.firstName} ${patient.lastName}`,
  )}.pdf`;
}

// Obstetric formula in compact form, e.g. "G 3, P 1, C 1, A 1, E 0 — 1 hijo
// vivo". Returns null when no value is set.
function obstetricFormula(g: NonNullable<PatientHistoryMedicalHistory['specialtyData']>): string | null {
  const parts: string[] = [];
  const push = (val: number | null | undefined, label: string) => {
    if (val == null) return;
    parts.push(`${label} ${val}`);
  };
  push(g.gravida, 'G');
  push(g.para, 'P');
  push(g.cesarean, 'C');
  push(g.abortions, 'A');
  push(g.ectopic, 'E');
  if (parts.length === 0 && (g.living_children == null || g.living_children <= 0)) {
    return null;
  }
  let summary = parts.join(', ');
  if (g.living_children != null && g.living_children > 0) {
    const word = g.living_children === 1 ? 'hijo vivo' : 'hijos vivos';
    summary = summary ? `${summary} — ${g.living_children} ${word}` : `${g.living_children} ${word}`;
  }
  return summary;
}

// ─── Document chrome ─────────────────────────────────────────────────────────

interface DocCtx {
  doc: PDFKit.PDFDocument;
  timeZone: string;
  generatedAt: Date;
}

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 width in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function ensureSpace(ctx: DocCtx, needed: number) {
  const { doc } = ctx;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottomLimit) {
    doc.addPage();
  }
}

function sectionHeading(ctx: DocCtx, text: string) {
  ensureSpace(ctx, 60);
  const { doc } = ctx;
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0a3d62').text(text);
  doc
    .moveTo(MARGIN, doc.y + 2)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2)
    .strokeColor('#0a3d62')
    .lineWidth(0.8)
    .stroke();
  doc.moveDown(0.6);
  doc.fillColor('#000000');
}

function subHeading(ctx: DocCtx, text: string) {
  ensureSpace(ctx, 30);
  const { doc } = ctx;
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f4e79').text(text);
  doc.fillColor('#000000').moveDown(0.2);
}

function field(ctx: DocCtx, label: string, value: string | number | null | undefined) {
  const v =
    value == null || (typeof value === 'string' && value.trim() === '')
      ? 'No registrado'
      : String(value);
  const { doc } = ctx;
  const startY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#3f3f46');
  doc.text(`${label}: `, MARGIN, startY, { continued: true, lineGap: 2 });
  doc.font('Helvetica').fillColor('#000000').text(v, { lineGap: 2 });
}

function paragraph(ctx: DocCtx, label: string, value: string | null | undefined) {
  const v = nonEmpty(value);
  ensureSpace(ctx, 40);
  const { doc } = ctx;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#3f3f46').text(label);
  doc.font('Helvetica').fontSize(10).fillColor('#000000').text(v ?? 'No registrado', {
    lineGap: 2,
    align: 'justify',
  });
  doc.moveDown(0.3);
}

function inlineRow(ctx: DocCtx, items: Array<[string, string | number | null | undefined]>) {
  const segments = items
    .filter(([, val]) => val != null && String(val).trim() !== '')
    .map(([label, val]) => `${label}: ${String(val)}`);
  if (segments.length === 0) return;
  ensureSpace(ctx, 20);
  ctx.doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(segments.join('   ·   '), {
    lineGap: 2,
  });
}

function divider(ctx: DocCtx) {
  ensureSpace(ctx, 14);
  const { doc } = ctx;
  doc.moveDown(0.4);
  doc
    .strokeColor('#d4d4d8')
    .lineWidth(0.4)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.moveDown(0.4);
  doc.strokeColor('#000000');
}

// ─── Section A: Cover page ───────────────────────────────────────────────────

function renderCover(ctx: DocCtx, p: PatientHistoryPayload) {
  const { doc } = ctx;
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0a3d62').text(p.clinic.name, {
    align: 'center',
  });
  if (p.clinic.address || p.clinic.phone) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#3f3f46')
      .text([p.clinic.address, p.clinic.phone].filter(Boolean).join(' · '), { align: 'center' });
  }
  doc.moveDown(4);
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor('#000000')
    .text('HISTORIA CLÍNICA', { align: 'center' });
  doc.moveDown(0.5);
  doc
    .font('Helvetica')
    .fontSize(16)
    .fillColor('#3f3f46')
    .text(`${p.patient.firstName} ${p.patient.lastName}`, { align: 'center' });
  doc.moveDown(0.5);
  const idLabel = ID_TYPE_LABELS[p.patient.idType] ?? p.patient.idType;
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#3f3f46')
    .text(`${idLabel} ${p.patient.idNumber}`, { align: 'center' });

  doc.moveDown(6);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#000000')
    .text(
      `Fecha de generación: ${fmtDateLongEs(ctx.generatedAt, ctx.timeZone)}`,
      { align: 'center' },
    );

  // Anchor the footer near the bottom of the page so it doesn't move when
  // the cover content above is shorter or longer.
  const footerY = doc.page.height - doc.page.margins.bottom - 50;
  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor('#71717a')
    .text('Documento generado por Hisamed — hisamed.com', MARGIN, footerY, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
  doc.fillColor('#000000');
}

// ─── Section B: Patient data ─────────────────────────────────────────────────

function renderPatientData(
  ctx: DocCtx,
  patient: PatientHistoryPatient,
  partner: PatientHistoryPartner | null,
  medicalHistory: PatientHistoryMedicalHistory | null,
) {
  sectionHeading(ctx, 'DATOS DEL PACIENTE');
  field(ctx, 'Nombre', `${patient.firstName} ${patient.lastName}`);
  field(ctx, 'Cédula', `${ID_TYPE_LABELS[patient.idType] ?? patient.idType} ${patient.idNumber}`);
  field(ctx, 'Fecha de nacimiento', formatDateEs(patient.dateOfBirth));
  const age = fmtAge(patient.dateOfBirth, ctx.timeZone, ctx.generatedAt);
  field(ctx, 'Edad', age != null ? `${age} años` : null);
  field(ctx, 'Sexo', SEX_LABELS[patient.sex] ?? patient.sex);
  field(ctx, 'Teléfono', patient.phone);
  field(ctx, 'Email', patient.email);
  field(ctx, 'Dirección', patient.address);
  field(
    ctx,
    'Grupo sanguíneo',
    patient.bloodType
      ? `${patient.bloodType}${patient.rhIncompatibility ? ' (Incompatibilidad Rh)' : ''}`
      : null,
  );

  // Highlighted allergies callout — duplicated from antecedentes because it
  // is critical safety information that the reader should see on page 1.
  const allergies = nonEmpty(medicalHistory?.allergies);
  if (allergies) {
    ensureSpace(ctx, 50);
    const { doc } = ctx;
    doc.moveDown(0.4);
    const startY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#7f1d1d');
    const height = doc.heightOfString(`⚠ ALERGIAS: ${allergies}`, {
      width: CONTENT_WIDTH - 12,
    });
    doc
      .save()
      .rect(MARGIN, startY - 4, CONTENT_WIDTH, height + 12)
      .fill('#fef2f2')
      .restore();
    doc.fillColor('#7f1d1d').text(`⚠ ALERGIAS: ${allergies}`, MARGIN + 6, startY + 2, {
      width: CONTENT_WIDTH - 12,
    });
    doc.moveDown(0.6).fillColor('#000000');
  }

  if (partner) {
    subHeading(ctx, 'DATOS DE LA PAREJA');
    field(ctx, 'Nombre', partner.fullName);
    field(ctx, 'Cédula', partner.idNumber);
    field(ctx, 'Fecha de nacimiento', partner.dateOfBirth ? formatDateEs(partner.dateOfBirth) : null);
    field(ctx, 'Teléfono', partner.phone);
    field(ctx, 'Email', partner.email);
    field(ctx, 'Grupo sanguíneo', partner.bloodType);
    field(ctx, 'Ocupación', partner.occupation);
    if (nonEmpty(partner.notes)) {
      paragraph(ctx, 'Notas', partner.notes);
    }
  }
}

// ─── Section C: Antecedentes ─────────────────────────────────────────────────

function renderAntecedentes(
  ctx: DocCtx,
  medicalHistory: PatientHistoryMedicalHistory | null,
) {
  sectionHeading(ctx, 'ANTECEDENTES');
  if (!medicalHistory) {
    ctx.doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#3f3f46')
      .text('No hay antecedentes registrados.');
    ctx.doc.fillColor('#000000');
    return;
  }

  paragraph(ctx, 'Antecedentes personales', medicalHistory.personalHistory);
  paragraph(ctx, 'Antecedentes familiares', medicalHistory.familyHistory);
  paragraph(ctx, 'Antecedentes quirúrgicos', medicalHistory.surgicalHistory);
  paragraph(ctx, 'Alergias', medicalHistory.allergies);
  paragraph(ctx, 'Medicación actual', medicalHistory.currentMedications);
  paragraph(ctx, 'Hábitos', medicalHistory.habits);

  const g = medicalHistory.specialtyData;
  if (g) {
    subHeading(ctx, 'Antecedentes ginecológicos / obstétricos');
    inlineRow(ctx, [
      ['Menarca', g.menarche_age != null ? `${g.menarche_age} años` : null],
      ['Ciclo', g.cycle_length_days != null ? `${g.cycle_length_days} días` : null],
      [
        'Regularidad',
        g.cycle_regularity ? CYCLE_REGULARITY_LABELS[g.cycle_regularity] : null,
      ],
    ]);
    inlineRow(ctx, [
      ['FUM', g.last_menstrual_period ? formatDateEs(g.last_menstrual_period) : null],
      [
        'Anticoncepción',
        g.contraceptive_method ? CONTRACEPTIVE_LABELS[g.contraceptive_method] : null,
      ],
    ]);
    inlineRow(ctx, [
      ['Última citología', g.pap_smear_last],
      ['Última mamografía', g.mammography_last],
    ]);

    const formula = obstetricFormula(g);
    if (formula) {
      ctx.doc.moveDown(0.3);
      ctx.doc.font('Helvetica-Bold').fontSize(10).fillColor('#3f3f46').text('Fórmula obstétrica');
      ctx.doc.font('Helvetica').fontSize(10).fillColor('#000000').text(formula);
    }
    if (g.pregnancy_ended) {
      inlineRow(ctx, [
        ['Embarazo finalizado', 'Sí'],
        [
          'Fecha de fin',
          g.pregnancy_ended_date ? formatDateEs(g.pregnancy_ended_date) : null,
        ],
      ]);
    } else if (g.last_menstrual_period) {
      inlineRow(ctx, [['Embarazo activo', 'Sí']]);
    }
    if (nonEmpty(g.obstetric_notes)) {
      paragraph(ctx, 'Notas obstétricas', g.obstetric_notes);
    }
  }
}

// ─── Section D: Consultas (clinical notes) ───────────────────────────────────

function renderGynecologicalExam(ctx: DocCtx, exam: GynecologicalExam) {
  // Render only blocks that have at least one populated subfield. The exam
  // schema is deeply optional, so a "render everything" loop would litter
  // the PDF with "No registrado" lines from the receptionist's checklist.
  const { doc } = ctx;
  const rows: Array<[string, string]> = [];
  const findingLabel = (
    label: string,
    f?: { value?: string | null; note?: string | null } | null,
  ) => {
    if (!f) return;
    const parts: string[] = [];
    if (f.value) parts.push(f.value);
    if (nonEmpty(f.note)) parts.push(f.note as string);
    if (parts.length > 0) rows.push([label, parts.join(' — ')]);
  };

  findingLabel('Labios mayores', exam.labia_majora);
  findingLabel('Labios menores', exam.labia_minora);
  findingLabel('Vulva', exam.vulva);
  findingLabel('Periné', exam.perineal);
  findingLabel('Vagina', exam.vagina);
  findingLabel('Cuello', exam.cervix);
  findingLabel('Secreción', exam.discharge);
  if (exam.uterus) {
    const u = exam.uterus;
    const bits = [u.size, u.position].filter(Boolean).join(' / ');
    if (bits) rows.push(['Útero', bits]);
    if (nonEmpty(u.consistency)) rows.push(['Consistencia uterina', u.consistency as string]);
    if (nonEmpty(u.mobility)) rows.push(['Movilidad uterina', u.mobility as string]);
    if (nonEmpty(u.pain)) rows.push(['Dolor uterino', u.pain as string]);
  }
  findingLabel('Anexo derecho', exam.right_adnexa);
  findingLabel('Anexo izquierdo', exam.left_adnexa);
  findingLabel('Fondo de saco de Douglas', exam.douglas_pouch);

  if (rows.length === 0 && (!exam.procedures || exam.procedures.length === 0)) return;
  subHeading(ctx, 'Examen ginecológico');
  for (const [label, val] of rows) {
    doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(`• ${label}: ${val}`);
  }
  if (exam.procedures && exam.procedures.length > 0) {
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#3f3f46').text('Procedimientos:');
    for (const p of exam.procedures) {
      const label = p.type === 'otro' && nonEmpty(p.custom_label) ? p.custom_label : p.type;
      const extra = nonEmpty(p.notes) ? ` — ${p.notes}` : '';
      doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(`• ${label}${extra}`);
    }
  }
}

function renderUltrasound(ctx: DocCtx, us: Ultrasound) {
  // The ultrasound schema mirrors the gyn-exam shape: lots of optional
  // sub-objects. Render only what is set so the PDF stays compact.
  const { doc } = ctx;
  const lines: string[] = [];
  const push = (label: string, val: string | number | null | undefined) => {
    if (val == null || (typeof val === 'string' && val.trim() === '')) return;
    lines.push(`${label}: ${val}`);
  };
  if (us.gynecological) {
    const g = us.gynecological;
    if (g.uterus) {
      const u = g.uterus;
      push('Útero posición', u.position);
      const dims = [u.length_mm, u.ap_mm, u.transverse_mm]
        .filter((v): v is number => v != null)
        .map((v) => `${v} mm`)
        .join(' × ');
      if (dims) lines.push(`Útero dimensiones: ${dims}`);
      push('Endometrio (mm)', u.endometrium_thickness_mm);
      push('Patrón endometrial', u.endometrium_pattern);
      if (nonEmpty(u.findings)) lines.push(`Hallazgos uterinos: ${u.findings}`);
    }
    if (g.right_ovary) {
      const o = g.right_ovary;
      const dims = [o.length_mm, o.width_mm, o.ap_mm]
        .filter((v): v is number => v != null)
        .map((v) => `${v} mm`)
        .join(' × ');
      const segs: string[] = [];
      if (dims) segs.push(dims);
      if (o.volume_ml != null) segs.push(`vol ${o.volume_ml} ml`);
      if (o.follicle_count != null) segs.push(`folículos ${o.follicle_count}`);
      if (segs.length > 0) lines.push(`Ovario derecho: ${segs.join(', ')}`);
      if (nonEmpty(o.findings)) lines.push(`Hallazgos OD: ${o.findings}`);
    }
    if (g.left_ovary) {
      const o = g.left_ovary;
      const dims = [o.length_mm, o.width_mm, o.ap_mm]
        .filter((v): v is number => v != null)
        .map((v) => `${v} mm`)
        .join(' × ');
      const segs: string[] = [];
      if (dims) segs.push(dims);
      if (o.volume_ml != null) segs.push(`vol ${o.volume_ml} ml`);
      if (o.follicle_count != null) segs.push(`folículos ${o.follicle_count}`);
      if (segs.length > 0) lines.push(`Ovario izquierdo: ${segs.join(', ')}`);
      if (nonEmpty(o.findings)) lines.push(`Hallazgos OI: ${o.findings}`);
    }
    if (g.bladder) {
      const parts = [g.bladder.value, nonEmpty(g.bladder.note)].filter(Boolean);
      if (parts.length > 0) lines.push(`Vejiga: ${parts.join(' — ')}`);
    }
    push('Líquido en Douglas', g.douglas_fluid);
  }
  if (us.obstetric) {
    const o = us.obstetric;
    push('Número fetal', o.fetal_count);
    push('Presentación', o.presentation);
    push('FCF', o.fetal_heart_rate);
    if (o.biometry) {
      const b = o.biometry;
      const bio = [
        b.bpd_mm != null ? `DBP ${b.bpd_mm} mm` : null,
        b.hc_mm != null ? `CC ${b.hc_mm} mm` : null,
        b.ac_mm != null ? `CA ${b.ac_mm} mm` : null,
        b.fl_mm != null ? `LF ${b.fl_mm} mm` : null,
      ].filter(Boolean);
      if (bio.length > 0) lines.push(`Biometría: ${bio.join(', ')}`);
      push('Peso estimado (g)', b.estimated_weight_g);
      push('Edad gestacional por biometría (sem)', b.estimated_ga_weeks);
    }
    if (o.amniotic_fluid) {
      push('ILA (cm)', o.amniotic_fluid.afi_cm);
      push('Bolsillo mayor (cm)', o.amniotic_fluid.sdp_cm);
    }
    if (o.placenta) {
      const parts = [o.placenta.location, o.placenta.grade && `Grado ${o.placenta.grade}`]
        .filter(Boolean)
        .join(' — ');
      if (parts) lines.push(`Placenta: ${parts}`);
    }
    if (nonEmpty(o.findings)) lines.push(`Hallazgos obstétricos: ${o.findings}`);
  }
  if (lines.length === 0) return;
  subHeading(ctx, 'Ecografía');
  for (const line of lines) {
    doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(`• ${line}`);
  }
}

function renderVitals(ctx: DocCtx, vitals: PatientHistoryVitalSigns[]) {
  if (vitals.length === 0) return;
  subHeading(ctx, 'Signos vitales');
  for (const v of vitals) {
    const bp =
      v.systolicBp != null && v.diastolicBp != null
        ? `${v.systolicBp}/${v.diastolicBp} mmHg`
        : null;
    const segs = [
      bp ? `TA ${bp}` : null,
      v.heartRate != null ? `FC ${v.heartRate} lpm` : null,
      v.respiratoryRate != null ? `FR ${v.respiratoryRate} rpm` : null,
      v.temperatureC != null ? `T ${v.temperatureC} °C` : null,
      v.oxygenSaturation != null ? `SpO₂ ${v.oxygenSaturation}%` : null,
      v.weightKg != null ? `Peso ${v.weightKg} kg` : null,
      v.heightCm != null ? `Talla ${v.heightCm} cm` : null,
      v.bmi != null ? `IMC ${v.bmi}` : null,
    ].filter(Boolean);
    if (segs.length === 0 && !nonEmpty(v.notes)) continue;
    ctx.doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#000000')
      .text(
        `• ${fmtDateTimeEs(v.recordedAt, ctx.timeZone)} — ${segs.join(', ') || 'Sin datos numéricos'}${
          nonEmpty(v.notes) ? ` (${v.notes})` : ''
        }`,
      );
  }
}

function renderNote(ctx: DocCtx, note: PatientHistoryNote) {
  ensureSpace(ctx, 120);
  const { doc } = ctx;
  // Draft notes MUST be clearly labeled — they have not been clinically
  // attested. Showing them in the same chrome as signed notes would let a
  // reader mistake provisional content for an official record.
  const statusSuffix = note.isSigned
    ? '  ✓ Firmada'
    : '  ⚠ BORRADOR — sin firmar';
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(note.isSigned ? '#0a3d62' : '#92400e')
    .text(`${formatDateEs(note.noteDate)} — ${note.authorFullName}${statusSuffix}`);
  doc.fillColor('#000000').moveDown(0.2);

  renderVitals(ctx, note.vitals);

  if (nonEmpty(note.chiefComplaint)) {
    paragraph(ctx, 'Motivo de consulta', note.chiefComplaint);
  }
  if (nonEmpty(note.subjective)) paragraph(ctx, 'Subjetivo', note.subjective);
  if (nonEmpty(note.objective)) paragraph(ctx, 'Objetivo', note.objective);
  if (nonEmpty(note.assessment)) paragraph(ctx, 'Evaluación / Análisis', note.assessment);
  if (nonEmpty(note.plan)) paragraph(ctx, 'Plan', note.plan);

  if (note.diagnoses.length > 0) {
    subHeading(ctx, 'Diagnósticos');
    for (const d of note.diagnoses) {
      const text = d.code ? `[${d.code}] ${d.text}` : d.text;
      doc.font('Helvetica').fontSize(10).fillColor('#000000').text(`• ${text}`);
    }
  }

  if (note.specialtyData?.gynecological_exam) {
    renderGynecologicalExam(ctx, note.specialtyData.gynecological_exam);
  }
  if (note.specialtyData?.ultrasound) {
    renderUltrasound(ctx, note.specialtyData.ultrasound);
  }
  if (nonEmpty(note.specialtyData?.ultrasound_findings)) {
    paragraph(ctx, 'Hallazgos ecográficos', note.specialtyData!.ultrasound_findings as string);
  }
  if (nonEmpty(note.specialtyData?.procedure_performed)) {
    paragraph(ctx, 'Procedimiento realizado', note.specialtyData!.procedure_performed as string);
  }
  if (nonEmpty(note.specialtyData?.treatment_protocol)) {
    paragraph(ctx, 'Protocolo de tratamiento', note.specialtyData!.treatment_protocol as string);
  }

  divider(ctx);
}

function renderConsultations(ctx: DocCtx, notes: PatientHistoryNote[]) {
  sectionHeading(ctx, 'CONSULTAS');
  if (notes.length === 0) {
    ctx.doc.font('Helvetica').fontSize(10).fillColor('#000000').text('Sin consultas registradas.');
    return;
  }
  for (const note of notes) {
    renderNote(ctx, note);
  }
}

// ─── Section E: Documentos generados ─────────────────────────────────────────

function renderDocuments(ctx: DocCtx, documents: PatientHistoryDocument[]) {
  sectionHeading(ctx, 'DOCUMENTOS GENERADOS');
  if (documents.length === 0) {
    ctx.doc.font('Helvetica').fontSize(10).fillColor('#000000').text('Sin documentos generados.');
    return;
  }
  for (const d of documents) {
    ensureSpace(ctx, 30);
    const label =
      CLINICAL_DOCUMENT_TYPE_LABELS[d.documentType as ClinicalDocumentType] ??
      String(d.documentType);
    const linked = d.clinicalNoteDate ? ` (consulta ${formatDateEs(d.clinicalNoteDate)})` : '';
    ctx.doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#000000')
      .text(
        `• ${fmtDateTimeEs(d.createdAt, ctx.timeZone)} — ${label}: ${d.title} — ${d.authorFullName}${linked}`,
      );
  }
}

// ─── Section F: Adjuntos ─────────────────────────────────────────────────────

function renderAttachments(ctx: DocCtx, attachments: PatientHistoryAttachment[]) {
  sectionHeading(ctx, 'ADJUNTOS');
  if (attachments.length === 0) {
    ctx.doc.font('Helvetica').fontSize(10).fillColor('#000000').text('Sin adjuntos registrados.');
    return;
  }
  for (const a of attachments) {
    ensureSpace(ctx, 28);
    const cat = a.category ? ATTACHMENT_CATEGORY_LABELS[a.category] ?? a.category : 'Otro';
    const linked = a.clinicalNoteDate ? ` (consulta ${formatDateEs(a.clinicalNoteDate)})` : '';
    ctx.doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#000000')
      .text(
        `• ${fmtDateTimeEs(a.uploadedAt, ctx.timeZone)} — ${a.fileName} — ${cat} — ${a.fileType} — ${a.uploadedByName}${linked}`,
      );
  }
}

// ─── Page footer (page numbers) ──────────────────────────────────────────────

function paintFooter(doc: PDFKit.PDFDocument, patientName: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#71717a')
      .text(
        `${patientName} · Página ${i + 1} de ${range.count}`,
        MARGIN,
        doc.page.height - 30,
        { width: CONTENT_WIDTH, align: 'center' },
      );
    doc.page.margins.bottom = oldBottomMargin;
  }
}

// ─── Public entrypoint ───────────────────────────────────────────────────────

export async function buildPatientHistoryPdf(
  payload: PatientHistoryPayload,
  generatedAt: Date = new Date(),
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      // bufferPages enables paintFooter to walk every page at the end and
      // stamp the page number once we know the total count.
      bufferPages: true,
      info: {
        Title: `Historia clínica — ${payload.patient.firstName} ${payload.patient.lastName}`,
        Author: payload.clinic.name,
        Creator: 'Hisamed',
        Producer: 'Hisamed PDF exporter',
        CreationDate: generatedAt,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const ctx: DocCtx = {
      doc,
      timeZone: payload.clinic.timezone,
      generatedAt,
    };

    renderCover(ctx, payload);

    doc.addPage();
    renderPatientData(ctx, payload.patient, payload.partner, payload.medicalHistory);

    renderAntecedentes(ctx, payload.medicalHistory);
    renderConsultations(ctx, payload.notes);
    renderDocuments(ctx, payload.documents);
    renderAttachments(ctx, payload.attachments);

    paintFooter(doc, `${payload.patient.firstName} ${payload.patient.lastName}`);

    doc.end();
  });
}
