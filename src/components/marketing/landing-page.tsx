'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Smartphone,
  ShieldCheck,
  Globe,
  ArrowRight,
  CalendarDays,
  Users,
  Stethoscope,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { AccessForm } from '@/components/marketing/access-form';
import { FeedbackForm } from '@/components/marketing/feedback-form';
import { COPY, type Lang } from '@/components/marketing/copy';

const FEATURE_ICONS = [FileText, Smartphone, ShieldCheck, Globe] as const;

const LEGAL_HREFS: Record<Lang, { terms: string; privacy: string; dpa: string }> = {
  es: { terms: '/terminos', privacy: '/privacidad', dpa: '/dpa' },
  en: { terms: '/terms', privacy: '/privacy', dpa: '/dpa-en' },
};

export function LandingPage({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = COPY[lang];

  // Switch language without a reload, keeping the URL shareable (?lang=…).
  const switchLang = useCallback((next: Lang) => {
    setLang(next);
    const url = new URL(window.location.href);
    if (next === 'es') url.searchParams.delete('lang');
    else url.searchParams.set('lang', next);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const legal = LEGAL_HREFS[lang];
  // English visitors carry their language into the demo so the demo banner can
  // surface a one-line note that the app itself is Spanish-only.
  const demoHref = lang === 'en' ? '/demo?lang=en' : '/demo';

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_120%_at_50%_0%,#f0fdfa_0%,#f8fafc_45%,#ffffff_100%)] text-slate-900">
      {/* ── Header ── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <BrandLogo size="sm" />
        <div className="flex items-center gap-3">
          <LangToggle lang={lang} onChange={switchLang} />
          <Link
            href="/login"
            className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:inline"
          >
            {t.nav.login}
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:pb-24 lg:pt-16">
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {t.hero.headline}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {t.hero.subheadline}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={demoHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#14B8A6,#0D9488)] px-6 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_18px_-5px_rgba(13,148,136,0.55)] transition-all hover:bg-[linear-gradient(180deg,#0D9488,#0F766E)] active:scale-[0.98]"
            >
              {t.hero.tryDemo}
            </a>
            <a
              href="#acceso"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/70 px-6 text-sm font-semibold text-slate-700 backdrop-blur transition-colors hover:border-slate-300 hover:bg-white"
            >
              {t.hero.requestAccess}
            </a>
          </div>
        </div>

        {/* Product-focused mockup (not a stock illustration): a stylized
            preview of the dashboard built from the app's own primitives. */}
        <HeroMockup caption={t.hero.mockupCaption} />
      </section>

      {/* ── Features ── */}
      <section className="border-t border-slate-900/5 bg-white/60">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t.features.heading}
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t.how.heading}
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {t.how.steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-slate-900/5 bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#14B8A6,#0F766E)] text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo + Access ── */}
      <section id="acceso" className="scroll-mt-8 border-t border-slate-900/5 bg-white/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:py-20">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t.cta.heading}
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* Demo card */}
            <div className="flex flex-col rounded-2xl border border-slate-900/5 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h3 className="text-lg font-semibold text-slate-900">{t.cta.demo.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.cta.demo.body}</p>
              <a
                href={demoHref}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#14B8A6,#0D9488)] px-5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_14px_-4px_rgba(13,148,136,0.5)] transition-all hover:bg-[linear-gradient(180deg,#0D9488,#0F766E)] active:scale-[0.98]"
              >
                {t.cta.demo.button}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Access card */}
            <div className="rounded-2xl border border-slate-900/5 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h3 className="text-lg font-semibold text-slate-900">{t.cta.access.title}</h3>
              <p className="mt-2 mb-5 text-sm leading-relaxed text-slate-600">{t.cta.access.body}</p>
              <AccessForm lang={lang} t={t.cta.access} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Feedback ── */}
      <section id="opinion" className="scroll-mt-8 border-t border-slate-900/5">
        <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 lg:py-20">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t.feedback.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-slate-600">
            {t.feedback.body}
          </p>
          <div className="mt-10 rounded-2xl border border-slate-900/5 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
            <FeedbackForm t={t.feedback} />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-900/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <Link href={legal.terms} className="hover:text-slate-900">{t.footer.terms}</Link>
            <Link href={legal.privacy} className="hover:text-slate-900">{t.footer.privacy}</Link>
            <Link href={legal.dpa} className="hover:text-slate-900">{t.footer.dpa}</Link>
          </div>
          <p className="text-sm text-slate-400">{t.footer.operator}</p>
          <LangToggle lang={lang} onChange={switchLang} />
        </div>
      </footer>
    </div>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 p-0.5 text-[13px] backdrop-blur">
      <button
        type="button"
        onClick={() => onChange('es')}
        aria-pressed={lang === 'es'}
        className={`rounded-full px-3 py-1 font-medium transition-colors ${
          lang === 'es' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Español
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={lang === 'en'}
        className={`rounded-full px-3 py-1 font-medium transition-colors ${
          lang === 'en' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        English
      </button>
    </div>
  );
}

// A clean, product-focused preview assembled from the app's own visual
// language (frosted panels, teal accents) rather than a stock SaaS hero image.
function HeroMockup({ caption }: { caption: string }) {
  return (
    <div className="relative">
      <div className="rounded-3xl border border-slate-900/5 bg-white/80 p-3 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.25)] backdrop-blur">
        <div className="overflow-hidden rounded-2xl border border-slate-900/5 bg-slate-50">
          {/* Top bar */}
          <div className="flex h-10 items-center gap-2 border-b border-slate-900/5 bg-white px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-0">
            {/* Sidebar */}
            <div className="space-y-2 border-r border-slate-900/5 bg-white p-3">
              {[Stethoscope, Users, CalendarDays, FileText].map((Icon, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                    i === 0 ? 'bg-teal-50 text-teal-700' : 'text-slate-400'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="h-2 w-12 rounded bg-current/20" />
                </div>
              ))}
            </div>
            {/* Content */}
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-slate-900/5 bg-white p-3">
                    <div className="h-2 w-8 rounded bg-teal-200" />
                    <div className="mt-2 h-4 w-10 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
              <div className="space-y-2 rounded-xl border border-slate-900/5 bg-white p-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-[linear-gradient(135deg,#14B8A6,#0F766E)]" />
                    <span className="h-2 flex-1 rounded bg-slate-100" />
                    <span className="h-2 w-10 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">{caption}</p>
    </div>
  );
}
