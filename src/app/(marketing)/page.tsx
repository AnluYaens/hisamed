import type { Metadata } from 'next';
import { LandingPage } from '@/components/marketing/landing-page';
import type { Lang } from '@/components/marketing/copy';

export const metadata: Metadata = {
  title: 'Hisamed — Historia clínica electrónica para tu consultorio',
  description:
    'Historia clínica electrónica para médicos de consulta privada. Tus pacientes, tu agenda, tus notas — en cualquier dispositivo, en cualquier momento.',
};

// Spanish is the default at `/`; English is selectable at `/?lang=en`. The
// initial language is resolved server-side from the query param; the toggle
// then switches client-side without a reload. Logged-in visitors never reach
// this page — the proxy redirects `/` to `/inicio` when an access cookie is
// present.
export default async function MarketingHome({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const initialLang: Lang = lang === 'en' ? 'en' : 'es';
  return <LandingPage initialLang={initialLang} />;
}
