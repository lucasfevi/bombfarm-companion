import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { splitGlossedTemplate } from '@bombfarm/ui/glossed-text';

const src = readFileSync(
  resolve(__dirname, '../../../../packages/ui/src/glossed-text.tsx'),
  'utf8',
);

describe('splitGlossedTemplate', () => {
  it('sorts tokens longest-first so a short token cannot shadow a longer overlapping one', () => {
    const terms = new Map([
      ['tree', 'Tree tip'],
      ['extraTree', 'ExtraTree tip'],
    ]);
    const parts = splitGlossedTemplate('extraTree bonus applies', terms);
    expect(parts).toContain('extraTree');
    expect(parts).not.toContain('tree');
  });

  it('splits on every distinct token, preserving in-between text parts', () => {
    const terms = new Map([
      ['atk', 'Attack tip'],
      ['mit', 'Mitigation tip'],
    ]);
    expect(splitGlossedTemplate('atk × mit × damage', terms)).toEqual([
      '',
      'atk',
      ' × ',
      'mit',
      ' × damage',
    ]);
  });

  it('returns the template as a single untouched part when there are no terms', () => {
    expect(splitGlossedTemplate('plain formula text', new Map())).toEqual([
      'plain formula text',
    ]);
  });
});

describe('GlossedText (source parity)', () => {
  it('renders the plain-wrapper span (no nested span) for the empty-terms early return', () => {
    expect(src).toMatch(/terms\.size === 0/);
    expect(src).toContain("<span className={cn('font-semibold text-ink', className)}>{template}</span>");
  });

  it('wraps a matched token in GlossaryTerm and an unmatched part in a plain span', () => {
    expect(src).toContain('GlossaryTerm');
    expect(src).toMatch(/terms\.get\(part\)/);
    expect(src).toContain('<span key={`t-${index}`}>{part}</span>');
  });
});
