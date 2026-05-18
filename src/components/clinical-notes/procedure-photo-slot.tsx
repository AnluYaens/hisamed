'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import {
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/validators/attachment';
import type { ProcedureType } from '@/lib/validators/clinical-note';

// Photo-only subset of the global attachment whitelist (no PDFs here).
const PHOTO_ACCEPT = Object.entries(ALLOWED_ATTACHMENT_MIME)
  .filter(([m]) => m.startsWith('image/'))
  .map(([m]) => m)
  .join(',');

function validatePhoto(file: File): string | null {
  if (file.size === 0) return 'El archivo está vacío';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'La imagen excede el tamaño máximo de 10MB';
  if (!file.type.toLowerCase().startsWith('image/')) {
    return 'Solo se aceptan imágenes (JPG o PNG)';
  }
  return null;
}

interface ProcedurePhotoSlotProps {
  label: string;
  patientId: string;
  /** When null, the slot is disabled with a hint to save the draft first. */
  clinicalNoteId: string | null;
  procedureType: ProcedureType;
  photoType: 'before' | 'after';
  /** UUID of the attachment row, or null when no photo has been uploaded. */
  attachmentId: string | null;
  disabled?: boolean;
  onChange: (attachmentId: string | null) => void;
}

// One slot = one photo (either "before" or "after") for one procedure entry.
// Uploads happen immediately to /api/attachments/upload with category set to
// `procedure_photo`. The returned attachment id is bubbled up so the parent
// stores it in the gynecological_exam JSONB. Removing a photo does NOT delete
// the underlying attachment row — it just unlinks it from the JSONB; the
// uploaded file stays in the patient's general attachments list. That's a
// deliberate choice so a doctor cannot silently destroy uploaded clinical
// evidence by clicking "remove" — deletes go through the normal attachment
// delete flow which is audited.
export function ProcedurePhotoSlot({
  label,
  patientId,
  clinicalNoteId,
  procedureType,
  photoType,
  attachmentId,
  disabled,
  onChange,
}: ProcedurePhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = !disabled && !isUploading && Boolean(clinicalNoteId);

  async function handleFile(file: File) {
    const err = validatePhoto(file);
    if (err) {
      setError(err);
      return;
    }
    if (!clinicalNoteId) {
      setError('Guarda el borrador antes de subir fotos.');
      return;
    }

    setError(null);
    setIsUploading(true);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('patient_id', patientId);
    fd.append('clinical_note_id', clinicalNoteId);
    fd.append('category', 'procedure_photo');
    fd.append(
      'description',
      `${procedureType} · ${photoType === 'before' ? 'antes' : 'después'}`,
    );

    try {
      const res = await fetch('/api/attachments/upload', { method: 'POST', body: fd });
      const json = (await res.json().catch(() => null)) as
        | { success: true; data: { id: string } }
        | { success: false; error?: string }
        | null;
      if (!res.ok || !json || json.success === false) {
        const msg = (json && json.success === false && json.error) || `Error ${res.status}`;
        setError(msg);
        return;
      }
      onChange(json.data.id);
    } catch {
      setError('Error de red al subir la foto');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }

  // Unlink (does NOT delete the underlying attachment).
  function unlink() {
    onChange(null);
    setError(null);
  }

  return (
    <div className="glass-surface rounded-2xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        {attachmentId && (
          <button
            type="button"
            onClick={unlink}
            disabled={disabled || isUploading}
            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
            aria-label={`Quitar ${label.toLowerCase()}`}
          >
            <Trash2 className="h-3 w-3" />
            Quitar
          </button>
        )}
      </div>

      {attachmentId ? (
        <a
          href={`/api/attachments/${attachmentId}/download`}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-xl border border-slate-900/8"
        >
          {/* Native <img> is intentional: download endpoint streams bytes,
              and it sits on the same origin so next/image's optimizer would
              refuse cross-route URLs without an extra config block. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/attachments/${attachmentId}/download`}
            alt={label}
            className="h-32 w-full object-cover"
          />
        </a>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload}
          className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-900/12 bg-slate-50/60 text-xs text-slate-500 transition-colors hover:border-teal-400 hover:bg-teal-50/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Subiendo…</span>
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              <span>{clinicalNoteId ? 'Agregar foto' : 'Guarda el borrador'}</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        onChange={onInputChange}
      />

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
