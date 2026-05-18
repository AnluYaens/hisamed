import { AtSign, Briefcase, Calendar, FileText, Mail, MapPin, Phone, Shield, User } from 'lucide-react';
import type { Patient } from '@/lib/db/schema';

function calcAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

const SEX_LABELS: Record<string, string> = { F: 'Femenino', M: 'Masculino', other: 'Otro' };
const ID_TYPE_LABELS: Record<string, string> = {
  cedula: 'Cédula',
  passport: 'Pasaporte',
  other: 'Documento',
};

interface PatientSummaryProps {
  patient: Patient;
}

export function PatientSummary({ patient }: PatientSummaryProps) {
  const age = calcAge(patient.dateOfBirth as string);
  const dob = formatDate(patient.dateOfBirth as string);
  const idLabel = ID_TYPE_LABELS[patient.idType] ?? 'Doc.';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Identity */}
      <SummaryCard title="Identificación" icon={<User className="h-4 w-4" />}>
        <DataRow label={idLabel} value={patient.idNumber} />
        <DataRow label="Nombre" value={`${patient.firstName} ${patient.lastName}`} />
        <DataRow label="Fecha de nac." value={dob} />
        <DataRow label="Edad" value={`${age} años`} />
        <DataRow label="Sexo" value={SEX_LABELS[patient.sex] ?? patient.sex} />
        <div className="flex items-center justify-between gap-2 text-sm">
          <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">Grupo sanguíneo</dt>
          <dd className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {patient.bloodType ?? '—'}
            </span>
            {patient.rhIncompatibility && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                ⚠️ Incompatibilidad Rh
              </span>
            )}
          </dd>
        </div>
        {patient.occupation && (
          <DataRow label="Ocupación" value={patient.occupation} icon={<Briefcase className="h-3 w-3" />} />
        )}
      </SummaryCard>

      {/* Contact */}
      <SummaryCard title="Contacto" icon={<Phone className="h-4 w-4" />}>
        <DataRow label="Teléfono" value={patient.phone ?? '—'} icon={<Phone className="h-3 w-3" />} />
        <DataRow label="Email" value={patient.email ?? '—'} icon={<Mail className="h-3 w-3" />} />
        <DataRow
          label="Dirección"
          value={patient.address ?? '—'}
          icon={<MapPin className="h-3 w-3" />}
        />
        {patient.instagram && (
          <DataRow label="Instagram" value={patient.instagram} icon={<AtSign className="h-3 w-3" />} />
        )}
        {patient.referralSource && (
          <DataRow label="Referido por" value={patient.referralSource} />
        )}
      </SummaryCard>

      {/* Emergency */}
      <SummaryCard title="Contacto de emergencia" icon={<Shield className="h-4 w-4" />}>
        <DataRow label="Nombre" value={patient.emergencyContactName ?? '—'} />
        <DataRow label="Teléfono" value={patient.emergencyContactPhone ?? '—'} />
        {patient.insuranceInfo && (
          <DataRow
            label="Seguro"
            value={patient.insuranceInfo}
            icon={<FileText className="h-3 w-3" />}
          />
        )}
      </SummaryCard>

      {/* Administrative */}
      <SummaryCard title="Administrativo" icon={<Calendar className="h-4 w-4" />}>
        <DataRow
          label="Registrado"
          value={patient.createdAt.toLocaleDateString('es-VE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        />
        <DataRow label="Estado" value={patient.isActive ? 'Activo' : 'Inactivo'} />
      </SummaryCard>

      {/* Notes */}
      {patient.notes && (
        <div className="glass-card rounded-[22px] p-5 sm:col-span-2">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <FileText className="h-4 w-4" />
            Notas
          </h3>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {patient.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-[22px] p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {icon}
        {title}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function DataRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="flex items-center gap-1 text-right font-medium text-zinc-800 dark:text-zinc-200">
        {icon}
        {value}
      </dd>
    </div>
  );
}
