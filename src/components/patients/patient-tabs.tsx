'use client';

import { useState, type ReactNode } from 'react';
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  Heart,
  Paperclip,
  Pencil,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PatientSummary } from '@/components/patients/patient-summary';
import { PatientForm } from '@/components/patients/patient-form';
import type { PatientDetail } from '@/queries/patients';
import { updatePatient } from '@/actions/patients';

export type PatientTabId =
  | 'datos'
  | 'pareja'
  | 'citas'
  | 'historia'
  | 'signos'
  | 'notas'
  | 'documentos'
  | 'adjuntos';

interface TabDef {
  id: PatientTabId;
  label: string;
  icon: typeof User;
}

const ALL_TABS: TabDef[] = [
  { id: 'datos', label: 'Datos personales', icon: User },
  { id: 'pareja', label: 'Pareja', icon: Heart },
  { id: 'citas', label: 'Citas', icon: CalendarDays },
  { id: 'historia', label: 'Historia clínica', icon: ClipboardList },
  { id: 'signos', label: 'Signos vitales', icon: Activity },
  { id: 'notas', label: 'Notas clínicas', icon: FileText },
  { id: 'documentos', label: 'Documentos', icon: FileSignature },
  { id: 'adjuntos', label: 'Adjuntos', icon: Paperclip },
];

interface PatientTabsProps {
  patient: NonNullable<PatientDetail>;
  // Whitelist of tab ids the server has authorized for this user. Any tab not
  // in this list is neither rendered in the nav nor in the content area, and
  // no amount of client-side state manipulation can reveal its contents.
  allowedTabs: PatientTabId[];
  /** "Today" in the clinic's timezone (YYYY-MM-DD). Forwarded to PatientForm. */
  todayStr: string;
  // Server-rendered slots for role-gated clinical tabs. `undefined` when the
  // current user isn't permitted to view them.
  historiaSlot?: ReactNode;
  notasSlot?: ReactNode;
  citasSlot?: ReactNode;
  documentosSlot?: ReactNode;
  adjuntosSlot?: ReactNode;
  parejaSlot?: ReactNode;
  signosSlot?: ReactNode;
}

export function PatientTabs({
  patient,
  allowedTabs,
  todayStr,
  historiaSlot,
  notasSlot,
  citasSlot,
  documentosSlot,
  adjuntosSlot,
  parejaSlot,
  signosSlot,
}: PatientTabsProps) {
  const allowed = new Set(allowedTabs);
  const initialTab: PatientTabId = allowed.has('datos')
    ? 'datos'
    : (allowedTabs[0] ?? 'datos');
  const [activeTab, setActiveTab] = useState<PatientTabId>(initialTab);
  const [editing, setEditing] = useState(false);

  const visibleTabs = ALL_TABS.filter((t) => allowed.has(t.id));

  return (
    <div className="space-y-5">
      {/* Tab nav — iOS-style segmented control */}
      <div className="flex items-center justify-between gap-3">
        <nav className="segmented max-w-full overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setEditing(false);
                }}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive}
                className={[
                  'segmented-item flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[13px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
                  isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === 'datos' && allowed.has('datos') && (
          <Button
            type="button"
            variant={editing ? 'ghost' : 'outline'}
            size="sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? (
              <>
                <X className="h-3.5 w-3.5" />
                Cancelar
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                Editar datos
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'datos' && allowed.has('datos') && (
        <div>
          {editing ? (
            <div className="glass-card rounded-[22px] p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Editar datos del paciente
              </h2>
              <PatientForm action={updatePatient} patient={patient} mode="edit" todayStr={todayStr} />
            </div>
          ) : (
            <PatientSummary patient={patient} />
          )}
        </div>
      )}

      {activeTab === 'pareja' && allowed.has('pareja') && (
        parejaSlot ?? (
          <PlaceholderSection
            title="Pareja"
            description="No hay datos de pareja registrados aún."
          />
        )
      )}

      {activeTab === 'citas' && allowed.has('citas') && (
        citasSlot ?? (
          <PlaceholderSection
            title="Citas"
            description="Las citas del paciente aparecerán aquí."
          />
        )
      )}

      {activeTab === 'historia' && allowed.has('historia') && historiaSlot}

      {activeTab === 'signos' && allowed.has('signos') && signosSlot}

      {activeTab === 'notas' && allowed.has('notas') && notasSlot}

      {activeTab === 'documentos' && allowed.has('documentos') && documentosSlot}

      {activeTab === 'adjuntos' && allowed.has('adjuntos') && (
        adjuntosSlot ?? (
          <PlaceholderSection
            title="Adjuntos"
            description="Los documentos y archivos del paciente aparecerán aquí."
          />
        )
      )}
    </div>
  );
}

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-14 text-center">
      <p className="text-[15px] font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-80 text-[13px] leading-relaxed text-slate-500">
        {description}
      </p>
    </div>
  );
}
