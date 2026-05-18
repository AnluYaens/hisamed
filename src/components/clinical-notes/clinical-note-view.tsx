import { CalendarDays, Film, Lock, ShieldAlert, User } from 'lucide-react';
import { ClinicalNoteStatusBadge } from '@/components/clinical-notes/status-badge';
import type { ClinicalNoteDetail } from '@/queries/clinical-notes';
import type {
  GynecologicalExam,
  ObstetricUltrasound,
  OvaryUltrasound,
  ProcedureEntry,
  ProcedureType,
  Ultrasound,
} from '@/lib/validators/clinical-note';
import { isVideoMime } from '@/lib/validators/attachment';
import {
  ADNEXA_LABELS,
  CERVIX_LABELS,
  DISCHARGE_LABELS,
  DOUGLAS_LABELS,
  LABIA_MAJORA_LABELS,
  LABIA_MINORA_LABELS,
  PERINEAL_LABELS,
  PROCEDURE_LABELS,
  UTERUS_POSITION_LABELS,
  UTERUS_SIZE_LABELS,
  VAGINA_LABELS,
  VULVA_LABELS,
} from '@/components/clinical-notes/gynecological-exam-section';
import {
  BLADDER_US_LABELS,
  DOUGLAS_FLUID_LABELS,
  ENDOMETRIUM_PATTERN_LABELS,
  FETAL_COUNT_LABELS,
  FETAL_PRESENTATION_LABELS,
  PLACENTA_GRADE_LABELS,
  PLACENTA_LOCATION_LABELS,
  UTERUS_US_POSITION_LABELS,
} from '@/components/clinical-notes/ultrasound-section';

interface UltrasoundAttachmentMeta {
  id: string;
  fileName: string;
  fileType: string;
}

interface ClinicalNoteViewProps {
  note: ClinicalNoteDetail;
  /**
   * True when the *current viewer* may see internal_notes. The value itself
   * is also nulled in the query for non-doctor roles, so this prop is just
   * for deciding whether to render the (empty) section at all.
   */
  canViewInternalNotes: boolean;
  /**
   * Procedure-photo attachments tied to this note, indexed by id. The page
   * already fetches `getAttachmentsByClinicalNote` for the attachments list,
   * so we just receive the relevant subset to render before/after thumbs
   * inline with the procedure entries.
   */
  procedurePhotos?: Record<string, { id: string; fileName: string }>;
  /**
   * Ultrasound attachments (images + short videos) tied to this note. The
   * id-only references live in `specialty_data.ultrasound.image_attachment_ids`;
   * the read view needs filename/fileType so it can render the right tag
   * (img vs video) and label.
   */
  ultrasoundAttachments?: UltrasoundAttachmentMeta[];
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        'glass-card rounded-[22px] p-5.5',
        className ?? '',
      ].join(' ')}
    >
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TextBlock({ value, placeholder }: { value: string | null; placeholder?: string }) {
  if (!value) {
    return (
      <p className="text-sm italic text-slate-400">
        {placeholder ?? 'Sin información registrada.'}
      </p>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-slate-800">{value}</p>
  );
}

function FindingRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string | null;
  note: string | null | undefined;
}) {
  if (!value && !note) return null;
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
      <span className="text-xs text-slate-500">{label}</span>
      <div>
        {value && (
          <span className="text-sm font-medium text-slate-900">
            {value}
          </span>
        )}
        {note && (
          <p className="mt-0.5 text-sm text-slate-700">{note}</p>
        )}
      </div>
    </div>
  );
}

function hasAnyExamData(g: GynecologicalExam | null | undefined): g is GynecologicalExam {
  if (!g) return false;
  return Object.values(g).some((v) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.values(v).some((x) => x != null && x !== '');
    return v !== '';
  });
}

function PhotoThumb({
  attachmentId,
  caption,
  attachments,
}: {
  attachmentId: string | null | undefined;
  caption: string;
  attachments: Record<string, { id: string; fileName: string }>;
}) {
  if (!attachmentId || !attachments[attachmentId]) return null;
  return (
    <figure className="space-y-1">
      <a
        href={`/api/attachments/${attachmentId}/download`}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-slate-900/8"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/attachments/${attachmentId}/download`}
          alt={caption}
          className="h-32 w-full object-cover"
        />
      </a>
      <figcaption className="text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

function ProcedureCard({
  procedure,
  attachments,
}: {
  procedure: ProcedureEntry;
  attachments: Record<string, { id: string; fileName: string }>;
}) {
  const label =
    procedure.type === 'otro' && procedure.custom_label
      ? procedure.custom_label
      : PROCEDURE_LABELS[procedure.type as ProcedureType];

  const beforeId = procedure.photos?.before ?? null;
  const afterId = procedure.photos?.after ?? null;
  const hasPhotos = Boolean(
    (beforeId && attachments[beforeId]) || (afterId && attachments[afterId]),
  );

  return (
    <div className="rounded-2xl border border-slate-900/6 bg-slate-50/60 p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      {procedure.notes && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
          {procedure.notes}
        </p>
      )}
      {hasPhotos && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PhotoThumb attachmentId={beforeId} caption="Antes" attachments={attachments} />
          <PhotoThumb attachmentId={afterId} caption="Después" attachments={attachments} />
        </div>
      )}
    </div>
  );
}

function GynecologicalExamReadOnly({
  exam,
  attachments,
}: {
  exam: GynecologicalExam;
  attachments: Record<string, { id: string; fileName: string }>;
}) {
  const procedures = exam.procedures ?? [];
  const uterus = exam.uterus ?? {};
  const hasUterusData =
    uterus.size || uterus.position || uterus.consistency || uterus.mobility || uterus.pain;

  return (
    <div className="space-y-5">
      {(exam.labia_majora || exam.labia_minora || exam.vulva || exam.perineal) && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Examen externo
          </p>
          <div className="divide-y divide-slate-900/6">
            <FindingRow
              label="Labios mayores"
              value={
                exam.labia_majora?.value ? LABIA_MAJORA_LABELS[exam.labia_majora.value] : null
              }
              note={exam.labia_majora?.note}
            />
            <FindingRow
              label="Labios menores"
              value={
                exam.labia_minora?.value ? LABIA_MINORA_LABELS[exam.labia_minora.value] : null
              }
              note={exam.labia_minora?.note}
            />
            <FindingRow
              label="Vulva"
              value={exam.vulva?.value ? VULVA_LABELS[exam.vulva.value] : null}
              note={exam.vulva?.note}
            />
            <FindingRow
              label="Región perineal"
              value={exam.perineal?.value ? PERINEAL_LABELS[exam.perineal.value] : null}
              note={exam.perineal?.note}
            />
          </div>
        </div>
      )}

      {(exam.vagina || exam.cervix || exam.discharge) && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Examen con espéculo
          </p>
          <div className="divide-y divide-slate-900/6">
            <FindingRow
              label="Vagina"
              value={exam.vagina?.value ? VAGINA_LABELS[exam.vagina.value] : null}
              note={exam.vagina?.note}
            />
            <FindingRow
              label="Cuello uterino"
              value={exam.cervix?.value ? CERVIX_LABELS[exam.cervix.value] : null}
              note={exam.cervix?.note}
            />
            <FindingRow
              label="Secreción"
              value={exam.discharge?.value ? DISCHARGE_LABELS[exam.discharge.value] : null}
              note={exam.discharge?.note}
            />
          </div>
        </div>
      )}

      {(hasUterusData || exam.right_adnexa || exam.left_adnexa || exam.douglas_pouch) && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Tacto bimanual
          </p>
          <div className="divide-y divide-slate-900/6">
            {uterus.size && (
              <FindingRow
                label="Útero · tamaño"
                value={UTERUS_SIZE_LABELS[uterus.size]}
                note={null}
              />
            )}
            {uterus.position && (
              <FindingRow
                label="Útero · posición"
                value={UTERUS_POSITION_LABELS[uterus.position]}
                note={null}
              />
            )}
            {uterus.consistency && (
              <FindingRow
                label="Útero · consistencia"
                value={uterus.consistency}
                note={null}
              />
            )}
            {uterus.mobility && (
              <FindingRow label="Útero · movilidad" value={uterus.mobility} note={null} />
            )}
            {uterus.pain && (
              <FindingRow label="Útero · dolor" value={uterus.pain} note={null} />
            )}
            <FindingRow
              label="Anexo derecho"
              value={
                exam.right_adnexa?.value ? ADNEXA_LABELS[exam.right_adnexa.value] : null
              }
              note={exam.right_adnexa?.note}
            />
            <FindingRow
              label="Anexo izquierdo"
              value={exam.left_adnexa?.value ? ADNEXA_LABELS[exam.left_adnexa.value] : null}
              note={exam.left_adnexa?.note}
            />
            <FindingRow
              label="Fondo de saco de Douglas"
              value={
                exam.douglas_pouch?.value ? DOUGLAS_LABELS[exam.douglas_pouch.value] : null
              }
              note={exam.douglas_pouch?.note}
            />
          </div>
        </div>
      )}

      {procedures.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Procedimientos realizados
          </p>
          <div className="space-y-3">
            {procedures.map((p) => (
              <ProcedureCard key={p.type} procedure={p} attachments={attachments} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ultrasound read view ────────────────────────────────────────────────────

function ultrasoundHasContent(
  u: Ultrasound | null | undefined,
  attachmentCount: number,
): boolean {
  if (!u && attachmentCount === 0) return false;
  if (attachmentCount > 0) return true;
  if (!u) return false;
  const check = (o: unknown): boolean => {
    if (o == null || o === '') return false;
    if (typeof o !== 'object') return true;
    return Object.values(o as Record<string, unknown>).some(check);
  };
  return check(u.gynecological) || check(u.obstetric);
}

function ovaryHasContent(o: OvaryUltrasound | null | undefined): boolean {
  if (!o) return false;
  return (
    o.length_mm != null ||
    o.width_mm != null ||
    o.ap_mm != null ||
    o.volume_ml != null ||
    o.follicle_count != null ||
    o.dominant_follicle_mm != null ||
    Boolean(o.findings)
  );
}

function OvaryReadOnly({
  label,
  ovary,
}: {
  label: string;
  ovary: OvaryUltrasound | undefined;
}) {
  if (!ovaryHasContent(ovary)) return null;
  const o = ovary as OvaryUltrasound;
  const dims = [o.length_mm, o.width_mm, o.ap_mm]
    .filter((v) => v != null)
    .map((v) => `${v}`)
    .join(' × ');
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
      <div className="divide-y divide-slate-900/6">
        {dims && <FindingRow label="Dimensiones (mm)" value={dims} note={null} />}
        {o.volume_ml != null && (
          <FindingRow label="Volumen" value={`${o.volume_ml.toFixed(2)} ml`} note={null} />
        )}
        {o.follicle_count != null && (
          <FindingRow label="Folículos (n)" value={String(o.follicle_count)} note={null} />
        )}
        {o.dominant_follicle_mm != null && (
          <FindingRow
            label="Folículo dominante"
            value={`${o.dominant_follicle_mm} mm`}
            note={null}
          />
        )}
        {o.findings && <FindingRow label="Hallazgos" value={null} note={o.findings} />}
      </div>
    </div>
  );
}

function obstetricHasContent(o: ObstetricUltrasound | null | undefined): boolean {
  if (!o) return false;
  return (
    o.fetal_count != null ||
    o.presentation != null ||
    o.fetal_heart_rate != null ||
    Boolean(
      o.biometry &&
        (o.biometry.bpd_mm != null ||
          o.biometry.hc_mm != null ||
          o.biometry.ac_mm != null ||
          o.biometry.fl_mm != null ||
          o.biometry.estimated_weight_g != null ||
          o.biometry.estimated_ga_weeks != null),
    ) ||
    Boolean(
      o.amniotic_fluid && (o.amniotic_fluid.afi_cm != null || o.amniotic_fluid.sdp_cm != null),
    ) ||
    Boolean(o.placenta && (o.placenta.location != null || o.placenta.grade != null)) ||
    Boolean(o.findings)
  );
}

function UltrasoundImageThumb({
  attachment,
}: {
  attachment: UltrasoundAttachmentMeta;
}) {
  const isVideo = isVideoMime(attachment.fileType);
  return (
    <figure className="space-y-1">
      <a
        href={`/api/attachments/${attachment.id}/download`}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-slate-900/8"
      >
        {isVideo ? (
          // Native <video> with the source pointed at the download endpoint.
          // `preload="metadata"` keeps page load light — the browser only
          // pulls the first chunk to render the poster, full bytes stream on
          // play.
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={`/api/attachments/${attachment.id}/download`}
            controls
            preload="metadata"
            className="h-40 w-full bg-black object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/attachments/${attachment.id}/download`}
            alt={attachment.fileName}
            className="h-40 w-full object-cover"
          />
        )}
      </a>
      <figcaption className="flex items-center gap-1 truncate text-xs text-slate-500">
        {isVideo && <Film className="h-3 w-3 shrink-0" />}
        <span className="truncate" title={attachment.fileName}>
          {attachment.fileName}
        </span>
      </figcaption>
    </figure>
  );
}

function UltrasoundReadOnly({
  ultrasound,
  attachments,
}: {
  ultrasound: Ultrasound | null | undefined;
  attachments: UltrasoundAttachmentMeta[];
}) {
  const gyn = ultrasound?.gynecological;
  const obs = ultrasound?.obstetric;
  const uterus = gyn?.uterus;
  const bladder = gyn?.bladder;
  const biometry = obs?.biometry;
  const amniotic = obs?.amniotic_fluid;
  const placenta = obs?.placenta;

  const uterusDims = [uterus?.length_mm, uterus?.ap_mm, uterus?.transverse_mm]
    .filter((v) => v != null)
    .map((v) => `${v}`)
    .join(' × ');
  const hasUterus =
    Boolean(uterus) &&
    (uterus?.position != null ||
      uterusDims !== '' ||
      uterus?.endometrium_thickness_mm != null ||
      uterus?.endometrium_pattern != null ||
      Boolean(uterus?.findings));

  return (
    <div className="space-y-5">
      {/* Gynecological */}
      {(hasUterus ||
        ovaryHasContent(gyn?.right_ovary) ||
        ovaryHasContent(gyn?.left_ovary) ||
        bladder?.value ||
        bladder?.note ||
        gyn?.douglas_fluid) && (
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Ecografía ginecológica
          </p>
          {hasUterus && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">
                Útero
              </p>
              <div className="divide-y divide-slate-900/6">
                {uterus?.position && (
                  <FindingRow
                    label="Posición"
                    value={UTERUS_US_POSITION_LABELS[uterus.position]}
                    note={null}
                  />
                )}
                {uterusDims && (
                  <FindingRow label="Dimensiones (mm)" value={uterusDims} note={null} />
                )}
                {uterus?.endometrium_thickness_mm != null && (
                  <FindingRow
                    label="Endometrio"
                    value={`${uterus.endometrium_thickness_mm} mm`}
                    note={null}
                  />
                )}
                {uterus?.endometrium_pattern && (
                  <FindingRow
                    label="Patrón endometrial"
                    value={ENDOMETRIUM_PATTERN_LABELS[uterus.endometrium_pattern]}
                    note={null}
                  />
                )}
                {uterus?.findings && (
                  <FindingRow label="Hallazgos" value={null} note={uterus.findings} />
                )}
              </div>
            </div>
          )}
          <OvaryReadOnly label="Ovario derecho" ovary={gyn?.right_ovary} />
          <OvaryReadOnly label="Ovario izquierdo" ovary={gyn?.left_ovary} />
          {(bladder?.value || bladder?.note) && (
            <FindingRow
              label="Vejiga"
              value={bladder?.value ? BLADDER_US_LABELS[bladder.value] : null}
              note={bladder?.note}
            />
          )}
          {gyn?.douglas_fluid && (
            <FindingRow
              label="Líquido libre en Douglas"
              value={DOUGLAS_FLUID_LABELS[gyn.douglas_fluid]}
              note={null}
            />
          )}
        </div>
      )}

      {/* Obstetric */}
      {obstetricHasContent(obs) && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Ecografía obstétrica
          </p>
          <div className="divide-y divide-slate-900/6">
            {obs?.fetal_count && (
              <FindingRow
                label="Número de fetos"
                value={FETAL_COUNT_LABELS[obs.fetal_count]}
                note={null}
              />
            )}
            {obs?.presentation && (
              <FindingRow
                label="Presentación"
                value={FETAL_PRESENTATION_LABELS[obs.presentation]}
                note={null}
              />
            )}
            {obs?.fetal_heart_rate != null && (
              <FindingRow
                label="FCF"
                value={`${obs.fetal_heart_rate} lpm`}
                note={null}
              />
            )}
            {biometry?.bpd_mm != null && (
              <FindingRow label="DBP" value={`${biometry.bpd_mm} mm`} note={null} />
            )}
            {biometry?.hc_mm != null && (
              <FindingRow label="CC" value={`${biometry.hc_mm} mm`} note={null} />
            )}
            {biometry?.ac_mm != null && (
              <FindingRow label="CA" value={`${biometry.ac_mm} mm`} note={null} />
            )}
            {biometry?.fl_mm != null && (
              <FindingRow label="LF" value={`${biometry.fl_mm} mm`} note={null} />
            )}
            {biometry?.estimated_weight_g != null && (
              <FindingRow
                label="Peso estimado (Hadlock)"
                value={`${biometry.estimated_weight_g} g`}
                note={null}
              />
            )}
            {biometry?.estimated_ga_weeks != null && (
              <FindingRow
                label="EG por biometría"
                value={`${biometry.estimated_ga_weeks.toFixed(1)} sem`}
                note={null}
              />
            )}
            {amniotic?.afi_cm != null && (
              <FindingRow label="ILA" value={`${amniotic.afi_cm} cm`} note={null} />
            )}
            {amniotic?.sdp_cm != null && (
              <FindingRow
                label="Bolsillo mayor"
                value={`${amniotic.sdp_cm} cm`}
                note={null}
              />
            )}
            {placenta?.location && (
              <FindingRow
                label="Placenta · localización"
                value={PLACENTA_LOCATION_LABELS[placenta.location]}
                note={null}
              />
            )}
            {placenta?.grade && (
              <FindingRow
                label="Placenta · grado"
                value={PLACENTA_GRADE_LABELS[placenta.grade]}
                note={null}
              />
            )}
            {obs?.findings && (
              <FindingRow label="Hallazgos adicionales" value={null} note={obs.findings} />
            )}
          </div>
        </div>
      )}

      {/* Image / video gallery */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Imágenes del eco
          </p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {attachments.map((a) => (
              <UltrasoundImageThumb key={a.id} attachment={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpecialtyRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}) {
  const display =
    value === null || value === undefined || value === ''
      ? null
      : `${value}${unit ? ` ${unit}` : ''}`;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">
        {display ?? <span className="italic text-slate-400">—</span>}
      </span>
    </div>
  );
}

export function ClinicalNoteView({
  note,
  canViewInternalNotes,
  procedurePhotos = {},
  ultrasoundAttachments = [],
}: ClinicalNoteViewProps) {
  const sp = note.specialtyData;
  const exam = sp?.gynecological_exam;
  const ultrasound = sp?.ultrasound;
  const showUltrasound = ultrasoundHasContent(ultrasound, ultrasoundAttachments.length);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-card rounded-[22px] p-5.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">
                Nota de evolución
              </h1>
              <ClinicalNoteStatusBadge isSigned={note.isSigned} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(note.noteDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {note.author.fullName}
              </span>
              {note.isSigned && note.signedAt && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Lock className="h-3.5 w-3.5" />
                  Firmada el {formatDateTime(note.signedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {note.chiefComplaint && (
          <p className="mt-4 text-sm text-slate-700">
            <span className="font-medium text-slate-900">
              Motivo de consulta:{' '}
            </span>
            {note.chiefComplaint}
          </p>
        )}
      </div>

      {/* SOAP */}
      <SectionCard title="Subjetivo">
        <TextBlock value={note.subjective} />
      </SectionCard>
      <SectionCard title="Objetivo">
        <TextBlock value={note.objective} />
      </SectionCard>
      <SectionCard title="Análisis / Evaluación">
        <TextBlock value={note.assessment} />
      </SectionCard>
      <SectionCard title="Plan">
        <TextBlock value={note.plan} />
      </SectionCard>

      {/* Diagnóstico */}
      {note.diagnoses.length > 0 && (
        <SectionCard title="Diagnóstico(s)">
          <ul className="space-y-2">
            {note.diagnoses.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                {d.code && (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-blue-600/12 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-700">
                    {d.code}
                  </span>
                )}
                <span className="text-sm text-slate-800">{d.text}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* specialty_data */}
      {sp && Object.values(sp).some((v) => v !== null && v !== undefined && v !== '') && (
        <SectionCard title="Datos de consulta ginecológica">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <SpecialtyRow label="TA" value={sp.blood_pressure ?? null} unit="mmHg" />
            <SpecialtyRow label="Peso" value={sp.weight_kg ?? null} unit="kg" />
            <SpecialtyRow label="Talla" value={sp.height_cm ?? null} unit="cm" />
            <SpecialtyRow label="IMC" value={sp.bmi ?? null} />
            <SpecialtyRow
              label="FUM"
              value={sp.last_menstrual_period ? formatDate(sp.last_menstrual_period) : null}
            />
            <SpecialtyRow
              label="Edad gestacional"
              value={sp.gestational_age_weeks ?? null}
              unit="sem"
            />
            <SpecialtyRow label="Folículos izquierdo" value={sp.follicle_count_left ?? null} />
            <SpecialtyRow label="Folículos derecho" value={sp.follicle_count_right ?? null} />
            <SpecialtyRow
              label="Grosor endometrial"
              value={sp.endometrial_thickness_mm ?? null}
              unit="mm"
            />
          </div>

          {sp.ultrasound_findings && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-slate-500">
                Hallazgos ecográficos
              </p>
              <TextBlock value={sp.ultrasound_findings ?? null} />
            </div>
          )}
          {sp.procedure_performed && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-slate-500">
                Procedimiento realizado
              </p>
              <TextBlock value={sp.procedure_performed ?? null} />
            </div>
          )}
          {sp.treatment_protocol && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-slate-500">
                Protocolo de tratamiento
              </p>
              <TextBlock value={sp.treatment_protocol ?? null} />
            </div>
          )}
        </SectionCard>
      )}

      {/* Examen ginecológico estructurado (si fue llenado) */}
      {hasAnyExamData(exam) && (
        <SectionCard title="Examen ginecológico">
          <GynecologicalExamReadOnly exam={exam} attachments={procedurePhotos} />
        </SectionCard>
      )}

      {/* Ecografía estructurada + galería de imágenes/videos */}
      {showUltrasound && (
        <SectionCard title="Ecografía">
          <UltrasoundReadOnly
            ultrasound={ultrasound}
            attachments={ultrasoundAttachments}
          />
        </SectionCard>
      )}

      {/* Internal notes — only rendered when the viewer is a doctor. The
          value itself is already NULLed in the query for any other role,
          but we also skip the whole section for clarity. */}
      {canViewInternalNotes && note.internalNotes && (
        <section className="rounded-[22px] border border-amber-600/20 bg-amber-100/55 p-5 backdrop-blur-md">
          <div className="mb-3 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Notas internas (solo visibles para médicos)
            </h2>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-800">
            {note.internalNotes}
          </p>
        </section>
      )}
    </div>
  );
}
