import { LegalPage } from '@/components/legal-page';
import { readLegalDoc, renderMarkdown } from '@/lib/legal';

export const metadata = {
  title: 'Terms of Service · Hisamed',
};

export default async function TermsPage() {
  const md = await readLegalDoc('en', 'terms');
  return <LegalPage>{renderMarkdown(md)}</LegalPage>;
}
