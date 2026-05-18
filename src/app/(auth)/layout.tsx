import { Activity, ShieldCheck, Stethoscope } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Two panels float over the ambient body backdrop: a frosted form card on
    // the left, the solid teal→slate brand panel on the right.
    <div className="fade-in flex min-h-full flex-1 items-stretch p-6">
      {/* ── Form side — frosted glass ── */}
      <div className="glass-card flex w-full flex-col rounded-[28px] px-6 py-10 sm:px-12 lg:w-1/2 lg:rounded-r-none lg:px-16">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            {/* Logo + product name, centered above the form */}
            <div className="mb-8 flex flex-col items-center text-center">
              <BrandLogo size="lg" iconOnly />
              <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.025em] text-slate-900">
                Hisamed
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Historia clínica electrónica
              </p>
            </div>
            {children}
          </div>
        </div>
        <footer className="mt-8 text-center text-xs text-slate-400">
          © 2026 Hisamed · Powered by Atriqon
        </footer>
      </div>

      {/* ── Branding side (desktop only) ── */}
      <div className="relative hidden overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0D9488_0%,#115E59_50%,#0F172A_100%)] shadow-[0_18px_40px_-16px_rgba(15,23,42,0.3)] lg:flex lg:w-1/2 lg:rounded-l-none">
        <div
          aria-hidden
          className="absolute -right-30 -top-30 h-115 w-115 rounded-full bg-[radial-gradient(closest-side,rgba(94,234,212,0.55),transparent_70%)] blur-[50px]"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-110 w-110 rounded-full bg-[radial-gradient(closest-side,rgba(125,211,252,0.45),transparent_70%)] blur-[50px]"
        />
        <div className="relative flex flex-col justify-center gap-10 px-16 text-white">
          <div>
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.02em]">
              La historia clínica de tu clínica, ordenada y segura.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-teal-50/85">
              Gestiona pacientes, agenda y notas clínicas en un solo lugar,
              diseñado para el día a día médico.
            </p>
          </div>
          <ul className="flex flex-col gap-3.5">
            {[
              { icon: Stethoscope, text: 'Notas clínicas y evolución estructuradas' },
              { icon: Activity, text: 'Agenda y seguimiento de pacientes en tiempo real' },
              { icon: ShieldCheck, text: 'Datos protegidos con auditoría completa' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]">
                  <Icon className="h-4.5 w-4.5 text-teal-100" />
                </span>
                <span className="text-[13px] text-teal-50/90">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
