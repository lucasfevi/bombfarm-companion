import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dataTableClass,
  dataTableHeadButtonClass,
  dataTableHeadClass,
  dataTableHeadSectionClass,
  dataTableSortIdleIconClass,
  sortableTableHeaderButtonClass,
} from '@bombfarm/ui/data-table.recipe';

/** Frozen source-of-truth from roster/import sort header button base. */
const legacyButtonClass =
  'inline-flex w-full cursor-pointer items-center gap-0.5 rounded-none border-0 bg-transparent px-2 py-[7px] text-[10px] font-semibold tracking-[0.02em] uppercase hover:bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]';

describe('dataTableHeadButtonClass parity', () => {
  it('matches legacy roster/import sort header button base', () => {
    expect(dataTableHeadButtonClass).toBe(legacyButtonClass);
    expect(sortableTableHeaderButtonClass).toBe(legacyButtonClass);
  });

  it('exposes idle stacked-chevron chrome class', () => {
    expect(dataTableSortIdleIconClass).toContain('flex-col');
    expect(dataTableSortIdleIconClass).toContain('opacity-45');
  });

  it('keeps sticky heads above row chrome without a collapse gap', () => {
    expect(dataTableClass).toContain('border-separate');
    expect(dataTableClass).toContain('border-spacing-0');
    expect(dataTableHeadSectionClass).toContain('sticky');
    expect(dataTableHeadSectionClass).toContain('z-20');
    expect(dataTableHeadClass).toContain('z-20');
    expect(dataTableHeadClass).toContain('box-shadow');
  });
});

describe('DataTable.Root scroll style', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../../packages/ui/src/data-table/data-table-root.tsx'),
    'utf8',
  );

  it('isolates the scrollport and only rem-caps when maxRows or minRows is set', () => {
    expect(src).toContain("scrollable && 'isolate min-h-0 overflow-auto'");
    expect(src).toContain('maxRows != null || minRows != null');
    expect(src).toContain('maxHeight: `calc(${rowHeight} * ${maxRows})`');
    expect(src).not.toMatch(/maxHeight: `calc\(\$\{rowHeight\} \* \$\{maxRows \|\| /);
  });
});
