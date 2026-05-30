import { LegalPage } from '@/components/legal-page';
import { readLegalDoc, renderMarkdown } from '@/lib/legal';

export const metadata = {
  title: 'Acuerdo de Tratamiento de Datos · Hisamed',
};

export default async function DpaPage() {
  const md = await readLegalDoc('es', 'dpa');
  return <LegalPage>{renderMarkdown(md)}</LegalPage>;
}
