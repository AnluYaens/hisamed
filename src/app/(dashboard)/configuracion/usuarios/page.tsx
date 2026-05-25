import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getClinicSettings } from '@/queries/clinic';
import { getClinicUsers } from '@/queries/users';
import { createUser, updateUser, resetUserPassword } from '@/actions/users';
import { UserManagement } from '@/components/settings/user-management';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { settingsTrail } from '@/lib/breadcrumbs';

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') notFound();

  const [clinicSettings, users] = await Promise.all([
    getClinicSettings(session.clinicId),
    getClinicUsers(session.clinicId),
  ]);

  return (
    <div className="fade-in p-6 sm:p-8 lg:px-10">
      <Breadcrumbs items={settingsTrail({ label: 'Usuarios' })} />

      <div className="mb-6">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
          Gestión de usuarios
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Usuarios con acceso a tu consultorio
        </p>
      </div>

      <UserManagement
        users={users}
        currentUserId={session.userId}
        createAction={createUser}
        updateAction={updateUser}
        resetAction={resetUserPassword}
        timezone={clinicSettings.timezone}
      />
    </div>
  );
}
