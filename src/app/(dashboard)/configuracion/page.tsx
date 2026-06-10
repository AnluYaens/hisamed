import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Shield, Users, Upload, Building2 } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getFullClinic } from '@/queries/clinic';
import { updateClinicSettings } from '@/actions/clinic';
import { ClinicSettingsForm } from '@/components/settings/clinic-settings-form';

const adminLinks = [
  {
    href: '/configuracion/usuarios',
    icon: Users,
    label: 'Gestión de usuarios',
    description: 'Crear, editar y desactivar usuarios de tu consultorio',
  },
  {
    href: '/configuracion/importar',
    icon: Upload,
    label: 'Importar pacientes',
    description: 'Cargar pacientes desde un archivo CSV',
  },
  {
    href: '/configuracion/auditoria',
    icon: Shield,
    label: 'Log de auditoría',
    description: 'Historial de acciones realizadas en el sistema',
  },
];

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin' && session.role !== 'doctor') {
    return (
      <div className="fade-in p-4 sm:p-8 lg:px-10">
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900 sm:text-[28px] md:text-[32px]">
          Configuración
        </h1>
        <p className="mt-4 text-sm text-slate-500">
          No tienes permisos para acceder a la configuración del sistema.
        </p>
      </div>
    );
  }

  const clinic = await getFullClinic(session.clinicId);
  if (!clinic) redirect('/login');

  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900 sm:text-[28px] md:text-[32px]">
        Configuración
      </h1>
      <p className="mt-1 text-sm text-slate-500">Ajustes del sistema</p>

      {/* Clinic Settings */}
      <section className="mt-8">
        <div className="mb-3.5 flex items-center gap-2.5">
          <div className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#5EEAD4,#14B8A6)]">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            Datos del consultorio
          </h2>
        </div>
        <div className="glass-card rounded-[22px] p-6">
          <ClinicSettingsForm clinic={clinic} action={updateClinicSettings} />
        </div>
      </section>

      {/* Admin links */}
      <section className="mt-8">
        <h2 className="mb-3.5 text-base font-semibold text-slate-900">
          Administración
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {adminLinks.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="glass-card group flex items-start gap-4 rounded-[20px] p-5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5"
            >
              <div className="glass-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#5EEAD4,#14B8A6)]">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{label}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                  {description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
