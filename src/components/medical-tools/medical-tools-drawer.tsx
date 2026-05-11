'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  calcGestationalAge,
  getGestationalTrimester,
  TRIMESTER_LABELS,
  calcFPPNaegele,
  calcFPPFromGestationalAge,
  getBMIResult,
  getGestationalWeightGain,
  formatDateEs,
} from '@/lib/obstetric';
import { todayStr } from '@/lib/dates';
import { cn } from '@/lib/utils';

// ─── Shared styles ────────────────────────────────────────────────────────────

function inputClass() {
  return 'flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
}

function labelClass() {
  return 'block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1';
}

function resultBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50',
        className,
      )}
    >
      {children}
    </div>
  );
}
const ResultBox = resultBox;

// ─── Tab: Edad gestacional ────────────────────────────────────────────────────

function EdadGestacionalTab() {
  const [fum, setFum] = useState('');
  const today = todayStr();

  const ga = fum ? calcGestationalAge(fum, today) : null;
  const fpp = fum ? calcFPPNaegele(fum) : null;
  const trimester = ga ? getGestationalTrimester(ga.weeks) : null;
  const tooFar = ga && ga.weeks >= 42;

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass()}>Fecha de última menstruación (FUM)</label>
        <input
          type="date"
          value={fum}
          onChange={(e) => setFum(e.target.value)}
          max={today}
          className={inputClass()}
        />
      </div>

      {ga && !tooFar && (
        <ResultBox>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {ga.weeks}{' '}
            <span className="text-base font-semibold">
              sem + {ga.days} día{ga.days !== 1 ? 's' : ''}
            </span>
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {trimester && TRIMESTER_LABELS[trimester]}
          </p>
          {fpp && (
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">FPP (Naegele):</span> {formatDateEs(fpp)}
            </p>
          )}
        </ResultBox>
      )}

      {tooFar && (
        <ResultBox className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            La FUM es de hace más de 42 semanas ({ga!.weeks} sem). Verifique la fecha.
          </p>
        </ResultBox>
      )}

      {ga && ga.weeks < 0 && (
        <ResultBox className="border-red-200 bg-red-50 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">La FUM no puede ser en el futuro.</p>
        </ResultBox>
      )}
    </div>
  );
}

// ─── Tab: Fecha probable de parto ─────────────────────────────────────────────

type FPPMode = 'fum' | 'eg';

function FPPTab() {
  const [mode, setMode] = useState<FPPMode>('fum');
  const [fum, setFum] = useState('');
  const [weeks, setWeeks] = useState('');
  const [days, setDays] = useState('');
  const today = todayStr();

  let fpp: string | null = null;
  if (mode === 'fum' && fum) {
    fpp = calcFPPNaegele(fum);
  } else if (mode === 'eg' && weeks !== '') {
    const w = Number(weeks);
    const d = Number(days || '0');
    if (!isNaN(w) && !isNaN(d) && w >= 0 && w <= 42) {
      fpp = calcFPPFromGestationalAge(w, d, today);
    }
  }

  // Use string comparison (safe for YYYY-MM-DD) to avoid clamping ambiguity.
  const fppInFuture = fpp !== null && fpp > today;
  const fppIsToday = fpp !== null && fpp === today;
  const remaining = fppInFuture ? calcGestationalAge(today, fpp!) : null;

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
        {(['fum', 'eg'] as FPPMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
              mode === m
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400',
            )}
          >
            {m === 'fum' ? 'Desde FUM' : 'Desde edad gestacional'}
          </button>
        ))}
      </div>

      {mode === 'fum' ? (
        <div>
          <label className={labelClass()}>Fecha de última menstruación</label>
          <input
            type="date"
            value={fum}
            onChange={(e) => setFum(e.target.value)}
            max={today}
            className={inputClass()}
          />
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelClass()}>Semanas actuales</label>
            <input
              type="number"
              min={0}
              max={42}
              placeholder="0"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              className={inputClass()}
            />
          </div>
          <div className="flex-1">
            <label className={labelClass()}>Días</label>
            <input
              type="number"
              min={0}
              max={6}
              placeholder="0"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
      )}

      {fpp && (
        <ResultBox>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Fecha probable de parto
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatDateEs(fpp)}
          </p>
          {fppIsToday && (
            <p className="mt-1 text-sm text-pink-700 dark:text-pink-400">
              La fecha probable de parto es hoy
            </p>
          )}
          {fppInFuture && remaining && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {remaining.weeks > 0
                ? `Faltan ${remaining.weeks} semana${remaining.weeks !== 1 ? 's' : ''} y ${remaining.days} día${remaining.days !== 1 ? 's' : ''}`
                : `Faltan ${remaining.days} día${remaining.days !== 1 ? 's' : ''}`}
            </p>
          )}
          {fpp !== null && !fppInFuture && !fppIsToday && (
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
              La fecha probable ya pasó
            </p>
          )}
        </ResultBox>
      )}
    </div>
  );
}

// ─── Tab: IMC ─────────────────────────────────────────────────────────────────

const BMI_COLOR_CLASSES: Record<string, string> = {
  blue: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-800',
  green: 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-900/20 dark:border-green-800',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-800',
  orange: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-900/20 dark:border-orange-800',
  red: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/20 dark:border-red-800',
};

function IMCTab() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);

  const wNum = parseFloat(weight);
  const hNum = parseFloat(height);
  const valid = !isNaN(wNum) && !isNaN(hNum) && wNum > 0 && hNum > 0;
  const result = valid ? getBMIResult(wNum, hNum) : null;
  const gainRec = result && isPregnant ? getGestationalWeightGain(result.bmi) : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass()}>Peso (kg)</label>
          <input
            type="number"
            min={1}
            max={500}
            step={0.1}
            placeholder="70.0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputClass()}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass()}>Talla (cm)</label>
          <input
            type="number"
            min={50}
            max={250}
            step={0.1}
            placeholder="165"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className={inputClass()}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={isPregnant}
          onChange={(e) => setIsPregnant(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 accent-blue-600"
        />
        Paciente embarazada (mostrar ganancia recomendada)
      </label>

      {result && (
        <div
          className={cn(
            'rounded-xl border p-4 space-y-2',
            BMI_COLOR_CLASSES[result.categoryColor],
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{result.bmi.toFixed(1)}</span>
            <span className="text-sm font-medium">kg/m²</span>
          </div>
          <p className="text-sm font-semibold">{result.category}</p>
          {gainRec && (
            <p className="border-t border-current/20 pt-2 text-sm">
              Ganancia de peso recomendada en el embarazo:{' '}
              <span className="font-semibold">{gainRec}</span>
            </p>
          )}
        </div>
      )}

      {/* BMI reference table */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Referencia IMC
        </p>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {[
              ['< 18.5', 'Bajo peso', 'text-blue-600 dark:text-blue-400'],
              ['18.5 – 24.9', 'Normal', 'text-green-600 dark:text-green-400'],
              ['25 – 29.9', 'Sobrepeso', 'text-yellow-600 dark:text-yellow-400'],
              ['30 – 34.9', 'Obesidad I', 'text-orange-600 dark:text-orange-400'],
              ['35 – 39.9', 'Obesidad II', 'text-red-600 dark:text-red-400'],
              ['≥ 40', 'Obesidad III', 'text-red-700 dark:text-red-300'],
            ].map(([range, label, cls]) => (
              <tr key={range}>
                <td className="py-1 font-mono text-zinc-600 dark:text-zinc-400">{range}</td>
                <td className={cn('py-1 font-medium', cls)}>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Dosis por peso ──────────────────────────────────────────────────────

function DosisPesoTab() {
  const [weight, setWeight] = useState('');
  const [dosePerKg, setDosePerKg] = useState('');
  const [unit, setUnit] = useState('mg');
  const [frequency, setFrequency] = useState('');

  const wNum = parseFloat(weight);
  const dNum = parseFloat(dosePerKg);
  const valid = !isNaN(wNum) && !isNaN(dNum) && wNum > 0 && dNum > 0;
  const total = valid ? wNum * dNum : null;

  const freqNum = parseFloat(frequency);
  const dailyTotal = total && !isNaN(freqNum) && freqNum > 0 ? total * freqNum : null;

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass()}>Peso del paciente (kg)</label>
        <input
          type="number"
          min={0.1}
          max={500}
          step={0.1}
          placeholder="70.0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className={inputClass()}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass()}>Dosis por kg</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="5"
            value={dosePerKg}
            onChange={(e) => setDosePerKg(e.target.value)}
            className={inputClass()}
          />
        </div>
        <div className="w-24">
          <label className={labelClass()}>Unidad</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={cn(inputClass(), 'cursor-pointer')}
          >
            <option value="mg">mg</option>
            <option value="mcg">mcg</option>
            <option value="g">g</option>
            <option value="UI">UI</option>
            <option value="mL">mL</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass()}>Frecuencia diaria (número de tomas, opcional)</label>
        <input
          type="number"
          min={1}
          max={24}
          step={1}
          placeholder="3"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className={inputClass()}
        />
      </div>

      {total !== null && (
        <ResultBox>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Dosis por toma
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {total % 1 === 0 ? total : total.toFixed(2)}{' '}
            <span className="text-base font-semibold">{unit}</span>
          </p>
          {dosePerKg && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {dosePerKg} {unit}/kg × {weight} kg
            </p>
          )}
          {dailyTotal !== null && (
            <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Total diario ({frequency} tomas)
              </p>
              <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {dailyTotal % 1 === 0 ? dailyTotal : dailyTotal.toFixed(2)}{' '}
                <span className="text-sm font-semibold">{unit}/día</span>
              </p>
            </div>
          )}
        </ResultBox>
      )}
    </div>
  );
}

// ─── Tabs definition ──────────────────────────────────────────────────────────

type TabId = 'eg' | 'fpp' | 'imc' | 'dosis';

const TABS: { id: TabId; label: string }[] = [
  { id: 'eg', label: 'Edad gestacional' },
  { id: 'fpp', label: 'Fecha de parto' },
  { id: 'imc', label: 'IMC' },
  { id: 'dosis', label: 'Dosis / peso' },
];

// ─── Main drawer ──────────────────────────────────────────────────────────────

export function MedicalToolsDrawer() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('eg');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Calculator className="h-4 w-4 shrink-0" />
        Herramientas médicas
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="flex-row items-center gap-2.5 border-b border-zinc-200 px-5 py-4 space-y-0 dark:border-zinc-800">
            <Calculator className="h-4 w-4 shrink-0 text-blue-600" />
            <SheetTitle className="text-sm font-semibold">Herramientas médicas</SheetTitle>
          </SheetHeader>

          {/* Tab bar */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'shrink-0 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'eg' && <EdadGestacionalTab />}
            {activeTab === 'fpp' && <FPPTab />}
            {activeTab === 'imc' && <IMCTab />}
            {activeTab === 'dosis' && <DosisPesoTab />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
