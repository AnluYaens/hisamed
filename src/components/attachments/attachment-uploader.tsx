'use client';

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ALLOWED_ATTACHMENT_MIME,
  attachmentCategoryValues,
  maxBytesForMime,
  type AttachmentCategory,
} from '@/lib/validators/attachment';

interface AttachmentUploaderProps {
  patientId: string;
  clinicalNoteId?: string;
  // Controls which category is selected by default. The dropdown still lets
  // the user override it.
  defaultCategory?: AttachmentCategory;
}

const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  lab_result: 'Resultado de laboratorio',
  imaging: 'Imagen / Eco',
  consent: 'Consentimiento',
  prescription: 'Récipe',
  procedure_photo: 'Foto de procedimiento',
  ultrasound: 'Ecografía',
  other: 'Otro',
};

const ACCEPT_ATTR = Object.keys(ALLOWED_ATTACHMENT_MIME).join(',');

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Client-side pre-flight check. The server re-validates both — this is just
// for a nicer error before we spend bandwidth.
function validateFile(file: File): string | null {
  if (file.size === 0) return 'El archivo está vacío';
  const mime = file.type?.toLowerCase() ?? '';
  if (!ALLOWED_ATTACHMENT_MIME[mime]) {
    return 'Tipo de archivo no permitido. Solo PDF, JPG, PNG, MP4 o MOV.';
  }
  const limit = maxBytesForMime(mime);
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return `El archivo excede el tamaño máximo de ${mb}MB`;
  }
  return null;
}

export function AttachmentUploader({
  patientId,
  clinicalNoteId,
  defaultCategory = 'other',
}: AttachmentUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>(defaultCategory);
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const categoryOptions = clinicalNoteId
    ? attachmentCategoryValues
    : attachmentCategoryValues.filter((c) => c !== 'ultrasound');

  function selectFile(nextFile: File | null) {
    setError(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    const err = validateFile(nextFile);
    if (err) {
      setFile(null);
      setError(err);
      return;
    }
    setFile(nextFile);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    selectFile(f);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    selectFile(f);
  }

  function onDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function clearForm() {
    setFile(null);
    setDescription('');
    setCategory(defaultCategory);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // Use XHR (not fetch) because XHR still exposes upload progress events.
  // fetch() has no browser support for request-body progress yet.
  async function doUpload(): Promise<void> {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('patient_id', patientId);
    if (clinicalNoteId) fd.append('clinical_note_id', clinicalNoteId);
    fd.append('category', category);
    if (description) fd.append('description', description);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/attachments/upload');
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          let msg = `Error ${xhr.status}`;
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) msg = body.error;
          } catch {
            // ignore
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error('Error de red al subir archivo'));
      xhr.send(fd);
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || progress !== null) return;
    setError(null);
    setProgress(0);
    try {
      await doUpload();
      clearForm();
      // Re-fetch server component with the new attachment in the list.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
      setProgress(null);
    }
  }

  const isUploading = progress !== null;
  const FileIcon = file?.type === 'application/pdf' ? FileText : ImageIcon;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!file ? (
        <label
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={[
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
              : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600',
          ].join(' ')}
        >
          <Upload className="mb-2 h-6 w-6 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Arrastra un archivo o haz clic para seleccionar
          </span>
          <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            PDF, JPG, PNG · máximo 10MB. MP4/MOV · máximo 50MB
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={onInputChange}
          />
        </label>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <FileIcon className="h-5 w-5 shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {file.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatBytes(file.size)}
              </p>
            </div>
            {!isUploading && (
              <button
                type="button"
                onClick={() => clearForm()}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {isUploading && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Subiendo… {progress}%
              </p>
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="attachment-category"
                className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Categoría
              </label>
              <select
                id="attachment-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as AttachmentCategory)}
                disabled={isUploading}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="attachment-description"
                className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Descripción (opcional)
              </label>
              <input
                id="attachment-description"
                type="text"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUploading}
                placeholder="ej: eco obstétrica 12 semanas"
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Subiendo
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Subir archivo
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
