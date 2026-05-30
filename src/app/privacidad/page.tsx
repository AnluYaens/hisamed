import { LegalPage } from '@/components/legal-page';
import { readLegalDoc, renderMarkdown } from '@/lib/legal';

export const metadata = {
  title: 'Política de Privacidad · Hisamed',
};

export default async function PrivacidadPage() {
  const md = await readLegalDoc('es', 'privacy');
  return <LegalPage>{renderMarkdown(md)}</LegalPage>;
}
