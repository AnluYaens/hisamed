'use client';

import { useRef, useState, useTransition, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, X } from 'lucide-react';
import { updatePartnerAvatar, removePartnerAvatar } from '@/actions/partner-avatar';

const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPT_ATTR = ALLOWED_AVATAR_MIME.join(',');

interface PartnerAvatarUploaderProps {
  patientId: string;
  hasAvatar: boolean;
}

function validateFile(file: File): string | null {
  if (file.size === 0) return 'El archivo está vacío';
  if (file.size > MAX_AVATAR_BYTES) return 'La foto excede el tamaño máximo de 2MB';
  const mime = file.type?.toLowerCase() ?? '';
  if (!ALLOWED_AVATAR_MIME.includes(mime)) return 'Solo se permiten imágenes JPG o PNG';
  return null;
}

export function PartnerAvatarUploader({ patientId, hasAvatar }: PartnerAvatarUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const preflight = validateFile(file);
    if (preflight) {
      setError(preflight);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const fd = new FormData();
    fd.append('patient_id', patientId);
    fd.append('file', file);

    startTransition(async () => {
      const result = await updatePartnerAvatar(null, fd);
      if (inputRef.current) inputRef.current.value = '';
      if (result && !result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onRemove() {
    setError(null);
    const fd = new FormData();
    fd.append('patient_id', patientId);
    startTransition(async () => {
      const result = await removePartnerAvatar(null, fd);
      if (result && !result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <label
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Subiendo
            </>
          ) : (
            <>
              <Camera className="h-3.5 w-3.5" />
              {hasAvatar ? 'Cambiar foto' : 'Subir foto'}
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={onChange}
            disabled={isPending}
          />
        </label>
        {hasAvatar && !isPending && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-3 w-3" />
            Quitar
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
