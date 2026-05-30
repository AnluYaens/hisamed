import type { ReactNode } from 'react';

/** Minimal, readable shell for the public legal documents. */
export function LegalPage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <article className="text-[15px]">{children}</article>
    </main>
  );
}
