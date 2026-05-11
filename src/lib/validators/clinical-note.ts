import { z } from 'zod';

// ─── Diagnosis entry ──────────────────────────────────────────────────────────

export const diagnosisEntrySchema = z.object({
  code: z.string().max(20).optional(),
  text: z.string().max(500),
});

export type DiagnosisEntry = z.infer<typeof diagnosisEntrySchema>;

// ─── specialty_data (consulta ginecológica) ───────────────────────────────────
// Schema for the JSONB `specialty_data` column on clinical notes. Mirrors
// PRD Técnico §1 plus `height_cm` which we keep here (not in the relational
// columns) so the BMI auto-calc has somewhere to persist its input.

export const bloodPressureRegex = /^\s*\d{2,3}\/\d{2,3}\s*$/;

// ─── Gynecological exam (subsección de specialty_data) ───────────────────────
// Estructura por bloque: cada hallazgo tiene un `value` (select cerrado) y un
// `note` (texto libre). El "otro" opcional permite escribir la opción que no
// estaba en la lista. El schema fija los enums para que el doctor solo pueda
// elegir valores válidos; cualquier matiz se escribe en `note`.

const examFinding = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .object({
      value: z.enum(values).nullable().optional(),
      note: z.string().max(500).nullable().optional(),
    })
    .partial();

export const labiaMajoraValues = ['normal', 'edema', 'lesiones', 'otro'] as const;
export const labiaMinoraValues = ['normal', 'adherencias', 'lesiones', 'otro'] as const;
export const vulvaValues = ['normal', 'leucoplasia', 'condilomas', 'otro'] as const;
export const perinealValues = ['normal', 'desgarros', 'cicatrices', 'otro'] as const;
export const vaginaValues = ['normal', 'leucorrea', 'lesiones', 'otro'] as const;
export const cervixValues = [
  'normal',
  'ectropion',
  'polipo',
  'lesion_sospechosa',
  'otro',
] as const;
export const dischargeValues = [
  'sin_secrecion',
  'blanca',
  'amarilla',
  'verdosa',
  'sanguinolenta',
] as const;
export const uterusSizeValues = ['normal', 'aumentado', 'disminuido'] as const;
export const uterusPositionValues = ['avf', 'rvf', 'lateral'] as const;
export const adnexaValues = ['normal', 'masa_palpable', 'dolor'] as const;
export const douglasValues = ['libre', 'abombado', 'doloroso'] as const;

export const procedureTypeValues = [
  'citologia',
  'cultivo_vaginal',
  'biopsia_cuello',
  'biopsia_vulva',
  'radiocirugia',
  'laser',
  'hifu',
  'exosoma',
  'colocacion_hilos',
  'otro',
] as const;

export type ProcedureType = (typeof procedureTypeValues)[number];

// Per-procedure entry. `photos` references attachment IDs uploaded with
// category='procedure_photo' — the actual file lives in the attachments
// table, this is just the linkage so the view can render before/after pairs
// next to the right procedure.
export const procedureEntrySchema = z.object({
  type: z.enum(procedureTypeValues),
  // Free-text label when type === 'otro'. Ignored otherwise.
  custom_label: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  photos: z
    .object({
      before: z.string().uuid().nullable().optional(),
      after: z.string().uuid().nullable().optional(),
    })
    .partial()
    .optional(),
});

export type ProcedureEntry = z.infer<typeof procedureEntrySchema>;

export const gynecologicalExamSchema = z
  .object({
    // External
    labia_majora: examFinding(labiaMajoraValues).optional(),
    labia_minora: examFinding(labiaMinoraValues).optional(),
    vulva: examFinding(vulvaValues).optional(),
    perineal: examFinding(perinealValues).optional(),
    // Speculum
    vagina: examFinding(vaginaValues).optional(),
    cervix: examFinding(cervixValues).optional(),
    discharge: examFinding(dischargeValues).optional(),
    // Bimanual
    uterus: z
      .object({
        size: z.enum(uterusSizeValues).nullable().optional(),
        position: z.enum(uterusPositionValues).nullable().optional(),
        consistency: z.string().max(200).nullable().optional(),
        mobility: z.string().max(200).nullable().optional(),
        pain: z.string().max(200).nullable().optional(),
      })
      .partial()
      .optional(),
    right_adnexa: examFinding(adnexaValues).optional(),
    left_adnexa: examFinding(adnexaValues).optional(),
    douglas_pouch: examFinding(douglasValues).optional(),
    // Procedures performed during this visit (structured replacement for the
    // free-text `procedure_performed` field — both can coexist).
    procedures: z.array(procedureEntrySchema).max(20).optional(),
  })
  .partial();

export type GynecologicalExam = z.infer<typeof gynecologicalExamSchema>;

// ─── Ecografía (subsección de specialty_data) ─────────────────────────────────
// El ginecólogo registra los hallazgos del eco transvaginal/pélvico (siempre)
// y del eco obstétrico (cuando hay embarazo activo). Las imágenes/videos del
// ecógrafo se cargan como attachments con `category = 'ultrasound'` y aquí
// guardamos solo los UUID — así el inline gallery puede renderizarlos sin
// duplicar metadatos.

export const uterusUltrasoundPositionValues = [
  'avf',
  'rvf',
  'lateral',
  'no_visualizado',
] as const;

export const endometriumPatternValues = [
  'trilaminar',
  'homogeneo',
  'heterogeneo',
  'no_evaluable',
] as const;

export const bladderUltrasoundValues = ['normal', 'distendida', 'con_contenido'] as const;

export const douglasFluidValues = ['ausente', 'escaso', 'moderado', 'abundante'] as const;

export const fetalCountValues = ['1', '2', '3+'] as const;

export const fetalPresentationValues = [
  'cefalica',
  'podalica',
  'transversa',
  'no_aplica',
] as const;

export const placentaLocationValues = [
  'anterior',
  'posterior',
  'fundica',
  'previa',
] as const;

// Grados de Grannum (madurez placentaria). Romanos para coincidir con la
// notación que usa el doctor en la clínica.
export const placentaGradeValues = ['0', 'I', 'II', 'III'] as const;

// Dimensiones de un ovario. Las medidas se piden en mm (lo que muestra el
// ecógrafo); el volumen se calcula como 0.523 × L × A × AP / 1000 (mm³ → ml).
// El cliente persiste el volumen ya calculado para no tener que recalcularlo
// al leer la nota.
export const ovaryUltrasoundSchema = z
  .object({
    length_mm: z.coerce.number().min(0).max(200).nullable().optional(),
    width_mm: z.coerce.number().min(0).max(200).nullable().optional(),
    ap_mm: z.coerce.number().min(0).max(200).nullable().optional(),
    volume_ml: z.coerce.number().min(0).max(1000).nullable().optional(),
    follicle_count: z.coerce.number().int().min(0).max(100).nullable().optional(),
    dominant_follicle_mm: z.coerce.number().min(0).max(100).nullable().optional(),
    findings: z.string().max(2000).nullable().optional(),
  })
  .partial();

export type OvaryUltrasound = z.infer<typeof ovaryUltrasoundSchema>;

export const gynecologicalUltrasoundSchema = z
  .object({
    uterus: z
      .object({
        position: z.enum(uterusUltrasoundPositionValues).nullable().optional(),
        length_mm: z.coerce.number().min(0).max(300).nullable().optional(),
        ap_mm: z.coerce.number().min(0).max(300).nullable().optional(),
        transverse_mm: z.coerce.number().min(0).max(300).nullable().optional(),
        endometrium_thickness_mm: z.coerce.number().min(0).max(50).nullable().optional(),
        endometrium_pattern: z.enum(endometriumPatternValues).nullable().optional(),
        findings: z.string().max(2000).nullable().optional(),
      })
      .partial()
      .optional(),
    right_ovary: ovaryUltrasoundSchema.optional(),
    left_ovary: ovaryUltrasoundSchema.optional(),
    bladder: z
      .object({
        value: z.enum(bladderUltrasoundValues).nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      })
      .partial()
      .optional(),
    douglas_fluid: z.enum(douglasFluidValues).nullable().optional(),
  })
  .partial();

export type GynecologicalUltrasound = z.infer<typeof gynecologicalUltrasoundSchema>;

export const obstetricUltrasoundSchema = z
  .object({
    fetal_count: z.enum(fetalCountValues).nullable().optional(),
    presentation: z.enum(fetalPresentationValues).nullable().optional(),
    fetal_heart_rate: z.coerce.number().int().min(0).max(300).nullable().optional(),
    biometry: z
      .object({
        // Diámetro biparietal (BPD/DBP)
        bpd_mm: z.coerce.number().min(0).max(200).nullable().optional(),
        // Circunferencia cefálica (HC/CC)
        hc_mm: z.coerce.number().min(0).max(500).nullable().optional(),
        // Circunferencia abdominal (AC/CA)
        ac_mm: z.coerce.number().min(0).max(500).nullable().optional(),
        // Longitud del fémur (FL/LF)
        fl_mm: z.coerce.number().min(0).max(200).nullable().optional(),
        // Peso estimado calculado por Hadlock (g)
        estimated_weight_g: z.coerce.number().min(0).max(8000).nullable().optional(),
        // Edad gestacional por biometría en semanas decimales (ej: 24.3)
        estimated_ga_weeks: z.coerce.number().min(0).max(45).nullable().optional(),
      })
      .partial()
      .optional(),
    amniotic_fluid: z
      .object({
        // Índice de líquido amniótico (cm)
        afi_cm: z.coerce.number().min(0).max(50).nullable().optional(),
        // Bolsillo mayor (cm) — alternativa a ILA antes de la semana 20
        sdp_cm: z.coerce.number().min(0).max(50).nullable().optional(),
      })
      .partial()
      .optional(),
    placenta: z
      .object({
        location: z.enum(placentaLocationValues).nullable().optional(),
        grade: z.enum(placentaGradeValues).nullable().optional(),
      })
      .partial()
      .optional(),
    findings: z.string().max(4000).nullable().optional(),
  })
  .partial();

export type ObstetricUltrasound = z.infer<typeof obstetricUltrasoundSchema>;

export const ultrasoundSchema = z
  .object({
    gynecological: gynecologicalUltrasoundSchema.optional(),
    obstetric: obstetricUltrasoundSchema.optional(),
    // Attachment IDs (category='ultrasound') uploaded for this consultation.
    // The order here is the order they render in the gallery.
    image_attachment_ids: z.array(z.string().uuid()).max(40).optional(),
  })
  .partial();

export type Ultrasound = z.infer<typeof ultrasoundSchema>;

export const clinicalNoteSpecialtyDataSchema = z.object({
  blood_pressure: z
    .string()
    .regex(bloodPressureRegex, 'Formato TA inválido (ej: 120/80)')
    .max(20)
    .nullable()
    .optional(),
  weight_kg: z.coerce.number().min(0).max(500).nullable().optional(),
  height_cm: z.coerce.number().min(0).max(250).nullable().optional(),
  bmi: z.coerce.number().min(0).max(200).nullable().optional(),
  last_menstrual_period: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .nullable()
    .optional(),
  gestational_age_weeks: z.coerce.number().min(0).max(45).nullable().optional(),
  ultrasound_findings: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(4000).nullable().optional(),
  ),
  follicle_count_left: z.coerce.number().int().min(0).max(100).nullable().optional(),
  follicle_count_right: z.coerce.number().int().min(0).max(100).nullable().optional(),
  endometrial_thickness_mm: z.coerce.number().min(0).max(50).nullable().optional(),
  procedure_performed: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(2000).nullable().optional(),
  ),
  treatment_protocol: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(2000).nullable().optional(),
  ),
  gynecological_exam: gynecologicalExamSchema.nullable().optional(),
  ultrasound: ultrasoundSchema.nullable().optional(),
});

export type ClinicalNoteSpecialtyData = z.infer<typeof clinicalNoteSpecialtyDataSchema>;

// ─── Create / Update ──────────────────────────────────────────────────────────
// PRD Técnico §6. The create schema only validates input coming from the
// frontend — server-side we still enforce author/clinic/role rules.

export const clinicalNoteCreateSchema = z.object({
  patient_id: z.string().uuid('ID de paciente inválido'),
  appointment_id: z
    .string()
    .uuid('ID de cita inválido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  note_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato YYYY-MM-DD)'),
  chief_complaint: z.string().max(1000).optional(),
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  diagnoses: z.array(diagnosisEntrySchema).max(10).optional(),
  internal_notes: z.string().max(5000).optional(),
  specialty_data: clinicalNoteSpecialtyDataSchema.optional(),
});

export type ClinicalNoteCreateInput = z.infer<typeof clinicalNoteCreateSchema>;

// Update reuses the same shape but makes every field optional (except the
// note id) so partial saves (e.g. "Guardar borrador" after editing one
// field) don't have to round-trip the entire form.
export const clinicalNoteUpdateSchema = clinicalNoteCreateSchema
  .partial()
  .extend({
    note_id: z.string().uuid('ID de nota inválido'),
  });

export type ClinicalNoteUpdateInput = z.infer<typeof clinicalNoteUpdateSchema>;

export const clinicalNoteSignSchema = z.object({
  note_id: z.string().uuid('ID de nota inválido'),
});

export type ClinicalNoteSignInput = z.infer<typeof clinicalNoteSignSchema>;
