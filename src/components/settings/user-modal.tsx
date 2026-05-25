'use client';

import { useActionState, useState } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserActionState } from '@/actions/users';
import type { UserListItem } from '@/queries/users';
import { echoValue, formKey } from '@/lib/forms/state';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  doctor: 'Médico',
  receptionist: 'Recepcionista',
};

// ─── Create User Modal ────────────────────────────────────────────────────────

interface CreateUserModalProps {
  action: (state: UserActionState, formData: FormData) => Promise<UserActionState>;
  onClose: () => void;
}

export function CreateUserModal({ action, onClose }: CreateUserModalProps) {
  const [state, formAction, isPending] = useActionState(action, null);

  const errors =
    state && !state.success && 'fieldErrors' in state ? state.fieldErrors : {};

  function field(name: string) {
    return errors?.[name]?.[0] ?? '';
  }

  if (state?.success) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[22px] border border-white/60 bg-white/90 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-slate-900/6 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Nuevo usuario
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form key={formKey(state)} action={formAction} className="space-y-4 p-6">
          {state && !state.success && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-600/20 bg-red-100/70 px-3.5 py-3 text-sm text-red-700 backdrop-blur-md">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{state.error}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              name="full_name"
              type="text"
              required
              defaultValue={echoValue(state, 'full_name') ?? ''}
              className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
            />
            {field('full_name') && (
              <p className="mt-1 text-xs text-red-600">{field('full_name')}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              defaultValue={echoValue(state, 'email') ?? ''}
              className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
            />
            {field('email') && (
              <p className="mt-1 text-xs text-red-600">{field('email')}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Contraseña <span className="text-red-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={10}
              className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Mínimo 10 caracteres</p>
            {field('password') && (
              <p className="mt-1 text-xs text-red-600">{field('password')}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Rol <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              defaultValue={echoValue(state, 'role') ?? 'receptionist'}
              className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {field('role') && (
              <p className="mt-1 text-xs text-red-600">{field('role')}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear usuario
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

interface EditUserModalProps {
  user: UserListItem;
  currentUserId: string;
  updateAction: (state: UserActionState, formData: FormData) => Promise<UserActionState>;
  resetAction: (state: UserActionState, formData: FormData) => Promise<UserActionState>;
  onClose: () => void;
}

export function EditUserModal({
  user,
  currentUserId,
  updateAction,
  resetAction,
  onClose,
}: EditUserModalProps) {
  const [tab, setTab] = useState<'edit' | 'password'>('edit');
  const [isActive, setIsActive] = useState(user.isActive);
  const [editState, editAction, editPending] = useActionState(updateAction, null);
  const [resetState, resetFormAction, resetPending] = useActionState(resetAction, null);

  const editErrors =
    editState && !editState.success && 'fieldErrors' in editState ? editState.fieldErrors : {};

  const isSelf = user.id === currentUserId;

  if (editState?.success || resetState?.success) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[22px] border border-white/60 bg-white/90 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-slate-900/6 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Editar usuario
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab selector — iOS-style segmented control */}
        <div className="px-6 pt-4">
          <nav className="segmented w-full">
            {(['edit', 'password'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                data-active={tab === t}
                className="segmented-item flex-1 px-3 py-1.5 text-[13px] text-slate-600 data-[active=true]:text-slate-900"
              >
                {t === 'edit' ? 'Datos' : 'Contraseña'}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'edit' && (
          <form key={formKey(editState)} action={editAction} className="space-y-4 p-6">
            <input type="hidden" name="user_id" value={user.id} />

            {editState && !editState.success && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-600/20 bg-red-100/70 px-3.5 py-3 text-sm text-red-700 backdrop-blur-md">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{editState.error}</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Nombre completo
              </label>
              <input
                name="full_name"
                type="text"
                defaultValue={echoValue(editState, 'full_name') ?? user.fullName}
                className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
              />
              {editErrors?.full_name?.[0] && (
                <p className="mt-1 text-xs text-red-600">{editErrors.full_name[0]}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Rol
              </label>
              <select
                name="role"
                defaultValue={echoValue(editState, 'role') ?? user.role}
                className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input type="hidden" name="is_active" value={isActive ? 'true' : 'false'} />
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={isSelf}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600 disabled:opacity-50"
                />
                <span className="text-sm text-slate-700">
                  Usuario activo
                  {isSelf && (
                    <span className="ml-1 text-xs text-slate-400">(no puedes desactivarte)</span>
                  )}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={editPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editPending}>
                {editPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        )}

        {tab === 'password' && (
          <form key={formKey(resetState)} action={resetFormAction} className="space-y-4 p-6">
            <input type="hidden" name="user_id" value={user.id} />

            {resetState && !resetState.success && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-600/20 bg-red-100/70 px-3.5 py-3 text-sm text-red-700 backdrop-blur-md">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{resetState.error}</p>
              </div>
            )}

            <p className="text-sm text-slate-500">
              Define una nueva contraseña para{' '}
              <span className="font-semibold text-slate-700">{user.fullName}</span>.
            </p>

            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Nueva contraseña <span className="text-red-500">*</span>
              </label>
              <input
                name="new_password"
                type="password"
                required
                minLength={10}
                className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Mínimo 10 caracteres</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={resetPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetPending}>
                {resetPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resetear contraseña
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
