'use client';

import { useState, type ReactNode } from 'react';
import { Pencil, X } from 'lucide-react';
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
}

const ALL_TABS: TabDef[] = [
  { id: 'datos', label: 'Datos personales' },
  { id: 'pareja', label: 'Pareja' },
  { id: 'citas', label: 'Citas' },
  { id: 'historia', label: 'Historia clínica' },
  { id: 'signos', label: 'Signos vitales' },
  { id: 'notas', label: 'Notas clínicas' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'adjuntos', label: 'Adjuntos' },
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
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setEditing(false);
              }}
              className={[
                'shrink-0 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'datos' && allowed.has('datos') && (
          <div className="pb-1 pl-2">
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
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'datos' && allowed.has('datos') && (
        <div>
          {editing ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-zinc-400 dark:text-zinc-500">{description}</p>
    </div>
  );
}
