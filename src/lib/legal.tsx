import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReactNode } from 'react';

/**
 * Minimal server-side renderer for the legal documents in `legal/{en,es}`.
 *
 * These pages are static markdown that we control, so we deliberately avoid
 * pulling in a full markdown dependency. The renderer supports only the subset
 * of markdown the legal docs actually use: headings, blockquotes, bullet lists,
 * GitHub-style tables, paragraphs, and inline `**bold**` / `*italic*` /
 * `` `code` ``. HTML comments (the lawyer-review notes at the top of each file)
 * are stripped and never rendered.
 */

export type LegalLocale = 'en' | 'es';

const LEGAL_DIR = path.join(process.cwd(), 'legal');

export async function readLegalDoc(
  locale: LegalLocale,
  slug: 'terms' | 'privacy' | 'dpa',
): Promise<string> {
  return readFile(path.join(LEGAL_DIR, locale, `${slug}.md`), 'utf8');
}

/** Strip HTML comments (top-of-file draft / lawyer-review notes). */
function stripComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, '');
}

/** Render inline `**bold**`, `*italic*`, and `` `code` `` to React nodes. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return tokens.filter(Boolean).map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-zinc-100 px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }
    return <span key={key}>{token}</span>;
  });
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Render the supported markdown subset to React elements. */
export function renderMarkdown(markdown: string): ReactNode {
  const lines = stripComments(markdown).split('\n');
  const blocks: ReactNode[] = [];

  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Headings.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], `h-${key}`);
      const cls =
        level === 1
          ? 'mt-0 mb-6 text-3xl font-semibold tracking-tight text-zinc-900'
          : level === 2
            ? 'mt-10 mb-3 text-xl font-semibold tracking-tight text-zinc-900'
            : 'mt-6 mb-2 text-base font-semibold text-zinc-900';
      const Tag = `h${level}` as 'h1';
      blocks.push(
        <Tag key={key++} className={cls}>
          {content}
        </Tag>,
      );
      i++;
      continue;
    }

    // Blockquote (one or more consecutive `>` lines).
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-6 rounded-r border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {renderInline(quote.join(' '), `bq-${key}`)}
        </blockquote>,
      );
      continue;
    }

    // GitHub-style table.
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) {
      const header = splitTableRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th
                    key={c}
                    className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-semibold text-zinc-700"
                  >
                    {renderInline(cell, `th-${key}-${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className="border border-zinc-200 px-3 py-2 align-top text-zinc-700"
                    >
                      {renderInline(cell, `td-${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Bullet list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-4 list-disc space-y-1.5 pl-6 text-zinc-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `li-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph (gather consecutive non-blank, non-special lines).
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !lines[i].startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="my-4 leading-relaxed text-zinc-700">
        {renderInline(para.join(' '), `p-${key}`)}
      </p>,
    );
  }

  return blocks;
}
