import { LegalPage } from '@/components/legal-page';
import { readLegalDoc, renderMarkdown } from '@/lib/legal';

export const metadata = {
  title: 'Data Processing Agreement · Hisamed',
};

export default async function DpaEnPage() {
  const md = await readLegalDoc('en', 'dpa');
  return <LegalPage>{renderMarkdown(md)}</LegalPage>;
}
