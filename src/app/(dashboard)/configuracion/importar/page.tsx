import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { CsvImporter } from '@/components/settings/csv-importer';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { settingsTrail } from '@/lib/breadcrumbs';

export default async function ImportarPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin' && session.role !== 'doctor') notFound();

  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      <Breadcrumbs items={settingsTrail({ label: 'Importar' })} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900 sm:text-[28px] md:text-[32px]">
          Importar pacientes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Carga masiva desde archivo CSV
        </p>
      </div>

      <div className="max-w-3xl">
        <div className="mb-4 rounded-2xl border border-teal-600/20 bg-teal-100/55 p-4 text-sm text-teal-800 backdrop-blur-md">
          <p className="font-semibold">Formato esperado del CSV</p>
          <p className="mt-1">
            El CSV puede tener las columnas en cualquier orden. El sistema las detecta
            automáticamente por el nombre. Puedes corregir el mapeo antes de importar.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
            <li>
              <span className="font-semibold">Requerido:</span> cédula, nombre, apellido,
              fecha_nacimiento (DD/MM/YYYY o YYYY-MM-DD), sexo (F/M)
            </li>
            <li>
              <span className="font-semibold">Opcional:</span> teléfono
            </li>
          </ul>
        </div>

        <div className="glass-card rounded-[22px] p-6">
          <CsvImporter />
        </div>
      </div>
    </div>
  );
}
