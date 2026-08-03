import { describe, expect, it } from 'vitest';
import {
  dataTableHeadButtonClass,
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
});
