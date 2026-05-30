import { LegalPage } from '@/components/legal-page';
import { readLegalDoc, renderMarkdown } from '@/lib/legal';

export const metadata = {
  title: 'Términos del Servicio · Hisamed',
};

export default async function TerminosPage() {
  const md = await readLegalDoc('es', 'terms');
  return <LegalPage>{renderMarkdown(md)}</LegalPage>;
}
