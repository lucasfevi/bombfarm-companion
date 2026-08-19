import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dataTableClass,
  dataTableHeadButtonClass,
  dataTableHeadClass,
  dataTableHeadInnerClass,
  dataTableHeadSectionClass,
  dataTableSortIdleIconClass,
  sortableTableHeaderButtonClass,
} from '@bombfarm/ui/data-table.recipe';

/**
 * `dataTableHeadButtonClass` used to be pinned byte-for-byte against a frozen legacy string —
 * that guarded a since-completed migration onto this primitive. Now that the primitive is the
 * only source and is free to evolve, these assert the invariants that actually matter: the
 * sortable button and the static inner share pad/type so columns stay aligned, a `before:` layer
 * — not the button's own (label-driven) box — carries the hover/focus affordance so it covers a
 * tall header's whole cell the same as a short one, and any transition is motion-safe-gated.
 */
describe('dataTableHeadButtonClass', () => {
  it('is a block-level flex box, not inline-flex (no table-cell baseline gap)', () => {
    expect(dataTableHeadButtonClass).toContain('w-full');
    expect(dataTableHeadButtonClass).not.toContain('inline-flex');
    expect(dataTableHeadButtonClass).toContain('flex');
  });

  it('shares pad/type with the static header inner so sortable and static columns align', () => {
    const sharedTypeTokens = [
      'px-2',
      'py-[7px]',
      'text-[10px]',
      'font-semibold',
      'tracking-[0.02em]',
      'uppercase',
      'items-center',
      'gap-0.5',
    ];
    for (const token of sharedTypeTokens) {
      expect(dataTableHeadButtonClass).toContain(token);
      expect(dataTableHeadInnerClass).toContain(token);
    }
  });

  it('carries the hover/focus affordance on a full-cell before: layer, not the button box', () => {
    expect(dataTableHeadButtonClass).toContain('before:absolute');
    expect(dataTableHeadButtonClass).toContain('before:inset-0');
    expect(dataTableHeadButtonClass).toContain("before:content-['']");
    expect(dataTableHeadButtonClass).not.toContain('hover:bg-[');
  });

  it('washes the whole cell with the theme accent on hover, gated by motion-safe', () => {
    expect(dataTableHeadButtonClass).toMatch(
      /hover:before:bg-\[color-mix\(in_oklch,var\(--accent\)_\d+%,transparent\)\]/,
    );
    expect(dataTableHeadButtonClass).toContain('motion-safe:before:transition-');
    expect(dataTableHeadButtonClass).toContain('motion-safe:before:duration-[120ms]');
    expect(dataTableHeadButtonClass).toContain('motion-safe:before:ease-out');
  });

  it('draws a crisp accent rule along the cell bottom on hover, as a sort affordance', () => {
    expect(dataTableHeadButtonClass).toMatch(/hover:before:shadow-\[inset_0_-2px_0_/);
  });

  it('keeps a visible, uncovered focus-visible ring spanning the full cell', () => {
    expect(dataTableHeadButtonClass).toContain('focus-visible:before:outline-2');
    expect(dataTableHeadButtonClass).toContain('focus-visible:before:outline-accent');
    expect(dataTableHeadButtonClass).not.toContain('focus-visible:before:outline-none');
    // Bare `outline` would collide with `outline-2` under cn()'s tailwind-merge and get
    // dropped, leaving outline-style unset — the style must come from the arbitrary property.
    expect(dataTableHeadButtonClass).toContain('[outline-style:solid]');
  });

  it('stays aliased for back-compat call sites', () => {
    expect(sortableTableHeaderButtonClass).toBe(dataTableHeadButtonClass);
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
