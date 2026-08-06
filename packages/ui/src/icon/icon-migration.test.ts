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

describe('icon migration parity — num spinner chevrons (rows 2–3)', () => {
  const src = readUiSource('num.tsx');

  it('renders increment and decrement chevrons through Icon at 14px', () => {
    expect(src).toContain('<Icon name="chevron-up" className="size-3.5" />');
    expect(src).toContain('<Icon name="chevron-down" className="size-3.5" />');
  });

  it('keeps parent button labels and drops react-icons', () => {
    expect(src).toContain('aria-label="Increment"');
    expect(src).toContain('aria-label="Decrement"');
    expect(src).not.toMatch(/from ['"]react-icons/);
  });
});

describe('icon migration parity — confirm-dialog close mark (row 4)', () => {
  const src = readUiSource('confirm-dialog.tsx');

  it('renders the close mark through Icon at default sm size', () => {
    expect(src).toContain('<Icon name="x-mark" />');
    expect(src).not.toMatch(/<Icon name="x-mark"[^>]*className/);
    expect(src).not.toMatch(/<Icon name="x-mark"[^>]*size/);
  });

  it('keeps Dialog.Close label and drops react-icons', () => {
    expect(src).toContain('<Dialog.Close aria-label={cancelLabel}>');
    expect(src).not.toMatch(/from ['"]react-icons/);
  });
});

describe('icon migration parity — accordion trigger chevron (row 5)', () => {
  const src = readUiSource('accordion/accordion-trigger.tsx');

  it('renders the trigger chevron through Icon with data-accordion-icon', () => {
    expect(src).toContain(
      '<Icon name="chevron-down" data-accordion-icon className={accordionIconClass} />',
    );
  });

  it('keeps accordionIconClass verbatim and drops react-icons', () => {
    expect(src).toContain('accordionIconClass');
    expect(src).not.toMatch(/from ['"]react-icons/);
  });
});

describe('icon migration parity — collapsible trigger chevron (row 6)', () => {
  const src = readUiSource('collapsible/collapsible-trigger.tsx');

  it('renders the trigger chevron through Icon with data-accordion-icon', () => {
    expect(src).toContain(
      '<Icon name="chevron-down" data-accordion-icon className={accordionIconClass} />',
    );
  });

  it('drops react-icons from collapsible trigger', () => {
    expect(src).not.toMatch(/from ['"]react-icons/);
  });
});
