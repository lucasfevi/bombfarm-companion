import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const uiSrc = resolve(import.meta.dirname, '..');

function readUiSource(relativePath: string): string {
  return readFileSync(resolve(uiSrc, relativePath), 'utf8');
}

describe('icon migration parity — select affix chevron (row 1)', () => {
  const src = readUiSource('select.tsx');

  it('renders the affix chevron through Icon at 14px', () => {
    expect(src).toContain('<Icon name="chevron-down" className="size-3.5" />');
  });

  it('keeps the decorative affix wrapper and drops react-icons', () => {
    expect(src).toContain('selectAffixClass');
    expect(src).toContain('aria-hidden');
    expect(src).not.toMatch(/from ['"]react-icons/);
  });
});
