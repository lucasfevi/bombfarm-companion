import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FARM_COLUMNS } from '@/features/phases/model/farm-ranking-view';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * Structural (source-scanning) coverage for the board's presentational components.
 *
 * SPEC_DEVIATION: the Test Coverage Matrix names "unit (existing apps/web component-test
 * idiom)" for this layer. There is no such idiom in this repo — zero `*.test.tsx` files exist
 * anywhere under `apps/web/src`, and neither `apps/web/package.json` nor `packages/ui/package.json`
 * carries `jsdom` or `@testing-library/react`. Adding either would be a new dependency, which
 * `AD-PFRC-02` and T9's "package.json dependency list is unchanged" gate both forbid introducing
 * for this feature. These tests instead follow the repo's REAL established genre for this kind
 * of assertion — source-scanning (`mod-17-max-props.test.ts`, `devtools-not-in-production-
 * bundle.test.ts`) — and the genuine DOM-rendered proof (testids resolve, empty states render no
 * numeric text, badges carry words, `<colgroup>`/header count match) is covered by the real
 * browser in `e2e/farm-ranking.spec.ts` (T8).
 */
function read(relativePath: string): string {
  return readFileSync(`${WEB_PACKAGE_ROOT}/${relativePath}`, 'utf8');
}

describe('Farm Ranking board — testids present (design §4.3)', () => {
  const expectations: [string, string][] = [
    ['src/features/phases/components/farm-ranking-board.tsx', 'farm-ranking'],
    ['src/features/phases/components/farm-ranking-board.tsx', 'farm-ranking-empty'],
    ['src/features/phases/components/farm-ranking-filters.tsx', 'farm-filter-unlocked'],
    ['src/features/phases/components/farm-ranking-filters.tsx', 'farm-filter-feasible'],
    ['src/features/phases/components/farm-ranking-filters.tsx', 'farm-filter-ato'],
    ['src/features/phases/components/farm-ranking-filters.tsx', 'farm-filter-gate'],
    ['src/features/phases/components/farm-rotation-pool.tsx', 'farm-pool'],
    ['src/features/phases/components/farm-return-bonus.tsx', 'farm-return-bonus'],
    ['src/features/phases/components/farm-ranking-table.tsx', 'farm-ranking-table'],
    ['src/features/phases/components/farm-ranking-table.tsx', 'farm-sort-live'],
  ];

  for (const [file, testid] of expectations) {
    it(`${file} declares data-testid="${testid}"`, () => {
      expect(read(file)).toContain(`data-testid="${testid}"`);
    });
  }

  it('farm-rotation-pool.tsx declares a per-hero testid template', () => {
    expect(read('src/features/phases/components/farm-rotation-pool.tsx')).toContain(
      'farm-pool-hero-${entry.heroId}',
    );
  });

  it('farm-ranking-row.tsx declares per-row and per-row-gold testid templates', () => {
    const source = read('src/features/phases/components/farm-ranking-row.tsx');
    expect(source).toContain('farm-row-${row.phase}');
    expect(source).toContain('farm-row-gold-${row.phase}');
  });
});

describe('Farm Ranking table — one header per FARM_COLUMNS entry, colgroup present', () => {
  it('renders headers by mapping FARM_COLUMNS (one <DataTable.Header> per entry, no hardcoded duplicates)', () => {
    const source = read('src/features/phases/components/farm-ranking-table.tsx');
    expect(source).toContain('FARM_COLUMNS.map((column)');
    // No column id is hardcoded as a second, separate <DataTable.Header> outside the map.
    const headerOccurrences = source.match(/<DataTable\.Header/g) ?? [];
    expect(headerOccurrences).toHaveLength(2); // the two branches of the single map (sortable/static)
  });

  it('declares a <colgroup> with one <col> per FARM_COLUMNS entry', () => {
    const source = read('src/features/phases/components/farm-ranking-table.tsx');
    expect(source).toContain('<colgroup>');
    expect(source).toContain('FARM_COLUMNS.map((column)');
    expect(source).toMatch(/<col key=\{column\.id\}/);
  });

  it('COLUMN_WIDTH_REM covers every FARM_COLUMNS id (no undefined widths -> no layout shift)', () => {
    const source = read('src/features/phases/components/farm-ranking-table.tsx');
    for (const column of FARM_COLUMNS) {
      expect(source, `missing width entry for column "${column.id}"`).toMatch(
        new RegExp(`${column.id}:\\s*\\d`),
      );
    }
  });
});

describe('Farm Ranking board — the four AD-PFRC-07 empty states render no numeric cell', () => {
  it('the roster-empty and zero-enabled branches hide the pool/filters row and never render FarmRankingTable', () => {
    const source = read('src/features/phases/components/farm-ranking-board.tsx');
    // The empty-state branch and the table branch are mutually exclusive (one ternary).
    expect(source).toMatch(/: empty \? \(/);
    expect(source).toMatch(/<FarmRankingTable/);
    // FarmRankingTable appears exactly once, inside the ": (" (else) arm of that ternary.
    const tableOccurrences = source.match(/<FarmRankingTable/g) ?? [];
    expect(tableOccurrences).toHaveLength(1);
  });

  it('compute-failed renders a Banner, never the table', () => {
    const source = read('src/features/phases/components/farm-ranking-board.tsx');
    expect(source).toMatch(/result\.reason === 'compute-failed'/);
    expect(source).toContain('<Banner');
  });
});

describe('Farm Ranking row — badges are text, always mounted (no-layout-shift rule 1)', () => {
  it('gate, push-target and infeasible badges render a t.* text child unconditionally (never {cond && ...})', () => {
    const source = read('src/features/phases/components/farm-ranking-row.tsx');
    expect(source).toContain('{t.farmRankingGateBadge}');
    expect(source).toContain('{t.farmRankingPushTargetBadge}');
    expect(source).toContain('{t.farmRankingInfeasibleBadge}');
    // Visibility is toggled via `invisible` + `aria-hidden`, not conditional mounting.
    expect(source).toMatch(/cn\(!row\.gate && 'invisible'\)/);
    expect(source).toMatch(/aria-hidden=\{!row\.gate\}/);
    expect(source).toMatch(/cn\(!row\.locked && 'invisible'\)/);
    expect(source).toMatch(/cn\(!row\.infeasible && 'invisible'\)/);
  });

  it('row activation is keyboard-operable (Enter/Space) and exposes aria-current', () => {
    const source = read('src/features/phases/components/farm-ranking-row.tsx');
    expect(source).toContain('tabIndex={0}');
    expect(source).toMatch(/aria-current=\{current \? 'true' : undefined\}/);
    expect(source).toMatch(/event\.key === 'Enter' \|\| event\.key === ' '/);
  });
});
