import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SortIdleIcon } from '../data-table/sort-idle-icon';

const uiSrc = resolve(import.meta.dirname, '..');

function readUiSource(relativePath: string): string {
  return readFileSync(resolve(uiSrc, relativePath), 'utf8');
}

function expectNoVendorIconImports(src: string) {
  const vendorIcons = 'react' + '-icons';
  expect(src).not.toMatch(new RegExp(`from ['"]${vendorIcons}`));
}

describe('icon migration parity — select affix chevron (row 1)', () => {
  const src = readUiSource('select.tsx');

  it('renders the affix chevron through Icon at 14px', () => {
    expect(src).toContain('<Icon name="chevron-down" className="size-3.5" />');
  });

  it('keeps the decorative affix wrapper and drops vendor icon imports', () => {
    expect(src).toContain('selectAffixClass');
    expect(src).toContain('aria-hidden');
    expectNoVendorIconImports(src);
  });
});

describe('icon migration parity — num spinner chevrons (rows 2–3)', () => {
  const src = readUiSource('num.tsx');

  it('renders increment and decrement chevrons through Icon at 14px', () => {
    expect(src).toContain('<Icon name="chevron-up" className="size-3.5" />');
    expect(src).toContain('<Icon name="chevron-down" className="size-3.5" />');
  });

  it('keeps parent button labels and drops vendor icon imports', () => {
    expect(src).toContain('aria-label="Increment"');
    expect(src).toContain('aria-label="Decrement"');
    expectNoVendorIconImports(src);
  });
});

describe('icon migration parity — confirm-dialog close mark (row 4)', () => {
  const src = readUiSource('confirm-dialog.tsx');

  it('renders the close mark through Icon at default sm size', () => {
    expect(src).toContain('<Icon name="x-mark" />');
    expect(src).not.toMatch(/<Icon name="x-mark"[^>]*className/);
    expect(src).not.toMatch(/<Icon name="x-mark"[^>]*size/);
  });

  it('keeps Dialog.Close label and drops vendor icon imports', () => {
    expect(src).toContain('<Dialog.Close aria-label={cancelLabel}>');
    expectNoVendorIconImports(src);
  });
});

describe('icon migration parity — accordion trigger chevron (row 5)', () => {
  const src = readUiSource('accordion/accordion-trigger.tsx');

  it('renders the trigger chevron through Icon with data-accordion-icon', () => {
    expect(src).toContain(
      '<Icon name="chevron-down" data-accordion-icon className={accordionIconClass} />',
    );
  });

  it('keeps accordionIconClass verbatim and drops vendor icon imports', () => {
    expect(src).toContain('accordionIconClass');
    expectNoVendorIconImports(src);
  });
});

describe('icon migration parity — collapsible trigger chevron (row 6)', () => {
  const src = readUiSource('collapsible/collapsible-trigger.tsx');

  it('renders the trigger chevron through Icon with data-accordion-icon', () => {
    expect(src).toContain(
      '<Icon name="chevron-down" data-accordion-icon className={accordionIconClass} />',
    );
  });

  it('drops vendor icon imports from collapsible trigger', () => {
    expectNoVendorIconImports(src);
  });
});

describe('icon migration parity — data-table sort chevrons (row 7)', () => {
  const src = readUiSource('data-table/data-table-header.tsx');

  it('renders active sort chevrons through Icon at xs size', () => {
    expect(src).toContain('<Icon name="chevron-up" size="xs" />');
    expect(src).toContain('<Icon name="chevron-down" size="xs" />');
  });

  it('drops vendor icon imports from data-table header', () => {
    expectNoVendorIconImports(src);
  });
});

describe('icon migration parity — sort idle chevrons (row 8)', () => {
  const src = readUiSource('data-table/sort-idle-icon.tsx');

  it('renders stacked idle chevrons through Icon at 8px', () => {
    expect(src).toContain('<Icon name="chevron-up" className="size-2 -mb-0.5" />');
    expect(src).toContain('<Icon name="chevron-down" className="size-2 -mt-0.5" />');
    expect(src).toContain('dataTableSortIdleIconClass');
    expect(src).toContain('aria-hidden="true"');
  });

  it('drops vendor icon imports from sort-idle-icon', () => {
    expectNoVendorIconImports(src);
  });

  it('renders markup with size-2 utilities and no duplicate size-4 recipe', () => {
    const html = renderToStaticMarkup(createElement(SortIdleIcon));
    expect(html).toContain('size-2');
    expect(html).toContain('-mb-0.5');
    expect(html).toContain('-mt-0.5');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('size-4');
  });
});

describe('icon migration parity — button coffee story (row 9)', () => {
  const src = readUiSource('button.stories.tsx');

  it('imports Icon as UiIcon to avoid story export collision', () => {
    expect(src).toContain('Icon as UiIcon');
    expect(src).toContain('<UiIcon name="coffee" />');
  });

  it('drops vendor icon imports from button stories', () => {
    expectNoVendorIconImports(src);
  });
});
