import { LegalPage } from '@/components/legal-page';
import { readLegalDoc, renderMarkdown } from '@/lib/legal';

export const metadata = {
  title: 'Privacy Policy · Hisamed',
};

export default async function PrivacyPage() {
  const md = await readLegalDoc('en', 'privacy');
  return <LegalPage>{renderMarkdown(md)}</LegalPage>;
}
