/**
 * Parse an agreement section `body` into renderable blocks. Pure and
 * framework-free so the public token page and the dashboard detail view render
 * bodies identically, and the parsing is unit-testable.
 *
 * Rules:
 *  - A run of consecutive lines starting with "• " or "- " becomes one bullet
 *    list (the marker is stripped).
 *  - Any other run of non-blank lines becomes a text block (newlines preserved).
 *  - Blank lines separate blocks.
 */

export type AgreementBodyBlock =
  | { type: 'bullets'; items: string[] }
  | { type: 'text'; text: string };

const BULLET_RE = /^\s*[•\-]\s+/;

export function parseAgreementBody(body: string): AgreementBodyBlock[] {
  const lines = (body ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: AgreementBodyBlock[] = [];
  let textBuffer: string[] = [];
  let bulletBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length) {
      blocks.push({ type: 'text', text: textBuffer.join('\n') });
      textBuffer = [];
    }
  };
  const flushBullets = () => {
    if (bulletBuffer.length) {
      blocks.push({ type: 'bullets', items: bulletBuffer });
      bulletBuffer = [];
    }
  };

  for (const line of lines) {
    if (line.trim() === '') {
      // Blank line ends whatever block we're in.
      flushText();
      flushBullets();
      continue;
    }
    if (BULLET_RE.test(line)) {
      flushText();
      bulletBuffer.push(line.replace(BULLET_RE, '').trim());
    } else {
      flushBullets();
      textBuffer.push(line);
    }
  }
  flushText();
  flushBullets();
  return blocks;
}
