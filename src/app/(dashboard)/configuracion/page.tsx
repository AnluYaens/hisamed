import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Shield, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';

const adminLinks = [
  {
    href: '/configuracion/auditoria',
    icon: Shield,
    label: 'Log de auditoría',
    description: 'Historial de acciones realizadas en el sistema',
  },
  {
    href: '/configuracion/usuarios',
    icon: Users,
    label: 'Gestión de usuarios',
    description: 'Crear, editar y desactivar usuarios de la clínica',
  },
];

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Configuración
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Ajustes del sistema</p>

      {session.role === 'admin' && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminLinks.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 group-hover:bg-blue-100 dark:bg-zinc-800 dark:group-hover:bg-blue-900/40">
                <Icon className="h-5 w-5 text-zinc-600 group-hover:text-blue-600 dark:text-zinc-400 dark:group-hover:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {session.role !== 'admin' && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No tienes permisos para acceder a la configuración del sistema.
        </p>
      )}
    </div>
  );
}
