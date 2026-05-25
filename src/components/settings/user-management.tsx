'use client';

import { useState } from 'react';
import { UserPlus, Edit2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserListItem } from '@/queries/users';
import type { UserActionState } from '@/actions/users';
import { CreateUserModal, EditUserModal } from './user-modal';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  doctor: 'Médico',
  receptionist: 'Recepcionista',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-violet-600/12 text-violet-700',
  doctor: 'bg-blue-600/12 text-blue-700',
  receptionist: 'bg-zinc-500/12 text-slate-700',
};

interface UserManagementProps {
  users: UserListItem[];
  currentUserId: string;
  createAction: (state: UserActionState, formData: FormData) => Promise<UserActionState>;
  updateAction: (state: UserActionState, formData: FormData) => Promise<UserActionState>;
  resetAction: (state: UserActionState, formData: FormData) => Promise<UserActionState>;
  timezone: string;
}

export function UserManagement({
  users,
  currentUserId,
  createAction,
  updateAction,
  resetAction,
  timezone,
}: UserManagementProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);

  function formatDate(date: Date | null): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('es-VE', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {users.length} usuario{users.length !== 1 ? 's' : ''} en tu consultorio
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-14 text-center">
          <p className="text-[15px] font-semibold text-slate-800">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="glass-surface overflow-hidden rounded-[20px]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-900/6 bg-slate-50/60">
                  <th className="px-4.5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Nombre
                  </th>
                  <th className="px-4.5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Email
                  </th>
                  <th className="px-4.5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Rol
                  </th>
                  <th className="px-4.5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Estado
                  </th>
                  <th className="px-4.5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Último acceso
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/4">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-teal-600/4"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">
                        {user.fullName}
                        {user.id === currentUserId && (
                          <span className="ml-2 text-xs font-normal text-zinc-400">(tú)</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4.5 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${ROLE_COLORS[user.role] ?? ''}`}
                      >
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
                          user.isActive
                            ? 'bg-green-700/14 text-green-700'
                            : 'bg-red-600/12 text-red-600'
                        }`}
                      >
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4.5 py-3 text-xs text-slate-500">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditingUser(user)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal action={createAction} onClose={() => setShowCreate(false)} />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          currentUserId={currentUserId}
          updateAction={updateAction}
          resetAction={resetAction}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}
