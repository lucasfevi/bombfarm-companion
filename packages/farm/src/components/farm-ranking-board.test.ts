import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FARM_COLUMNS } from '../model/farm-ranking-view';

/**
 * Structural (source-scanning) coverage for the board's presentational components.
 *
 * Not component tests, because this repo has no idiom for them: no `*.test.tsx` renders a
 * component anywhere in it, and no package carries `jsdom` or `@testing-library/react`. Adding
 * either would be a new dependency for one layer's tests. These follow the repo's real
 * established genre for this kind of assertion — source-scanning — and the genuine DOM-rendered
 * proof (testids resolve, empty states render no numeric text, badges carry words,
 * `<colgroup>`/header count match) is covered by the real browser in the web app's farm-ranking
 * and farm-optimize-button end-to-end specs.
 *
 * `readFileSync` on a bare file name is deliberate: a renamed or moved subject throws here rather
 * than leaving a guard that passes while scanning nothing.
 */
const COMPONENTS_DIR = fileURLToPath(new URL('.', import.meta.url));

function read(fileName: string): string {
  return readFileSync(join(COMPONENTS_DIR, fileName), 'utf8');
}

describe('Farm Ranking board — testids present', () => {
  const expectations: [string, string][] = [
    ['farm-ranking-board.tsx', 'farm-ranking'],
    ['farm-ranking-board.tsx', 'farm-ranking-empty'],
    ['farm-ranking-filters.tsx', 'farm-filter-unlocked'],
    ['farm-ranking-filters.tsx', 'farm-filter-ato'],
    ['farm-ranking-filters.tsx', 'farm-filter-gate'],
    ['farm-ranking-filters.tsx', 'farm-filter-item-level'],
    ['farm-rotation-pool.tsx', 'farm-pool'],
    ['farm-return-bonus.tsx', 'farm-return-bonus'],
    ['farm-ranking-table.tsx', 'farm-ranking-table'],
    ['farm-ranking-table.tsx', 'farm-sort-live'],
    ['farm-optimize-button.tsx', 'farm-optimize'],
  ];

  for (const [file, testid] of expectations) {
    it(`${file} declares data-testid="${testid}"`, () => {
      expect(read(file)).toContain(`data-testid="${testid}"`);
    });
  }

  it('farm-rotation-pool.tsx declares a per-hero testid template', () => {
    expect(read('farm-rotation-pool.tsx')).toContain(
      'farm-pool-hero-${entry.heroId}',
    );
  });

  it('farm-ranking-row.tsx declares per-row and per-row-gold testid templates', () => {
    const source = read('farm-ranking-row.tsx');
    expect(source).toContain('farm-row-${row.phase}');
    expect(source).toContain('farm-row-gold-${row.phase}');
  });
});

describe('Farm Ranking table — one header per FARM_COLUMNS entry, colgroup present', () => {
  it('renders headers by mapping FARM_COLUMNS (one <DataTable.Header> per entry, no hardcoded duplicates)', () => {
    const source = read('farm-ranking-table.tsx');
    expect(source).toContain('FARM_COLUMNS.map((column)');
    // No column id is hardcoded as a second, separate <DataTable.Header> outside the map.
    const headerOccurrences = source.match(/<DataTable\.Header/g) ?? [];
    expect(headerOccurrences).toHaveLength(2); // the two branches of the single map (sortable/static)
  });

  it('declares a <colgroup> with one <col> per FARM_COLUMNS entry', () => {
    const source = read('farm-ranking-table.tsx');
    expect(source).toContain('<colgroup>');
    expect(source).toContain('FARM_COLUMNS.map((column)');
    expect(source).toMatch(/<col key=\{column\.id\}/);
  });

  it('COLUMN_WIDTH_REM covers every FARM_COLUMNS id (no undefined widths -> no layout shift)', () => {
    const source = read('farm-ranking-table.tsx');
    for (const column of FARM_COLUMNS) {
      expect(source, `missing width entry for column "${column.id}"`).toMatch(
        new RegExp(`${column.id}:\\s*\\d`),
      );
    }
  });
});

describe('Farm Ranking board — the four empty states render no numeric cell', () => {
  it('the roster-empty and zero-enabled branches hide the pool/filters row and never render FarmRankingTable', () => {
    const source = read('farm-ranking-board.tsx');
    // The empty-state branch and the table branch are mutually exclusive (one ternary).
    expect(source).toMatch(/: empty \? \(/);
    expect(source).toMatch(/<FarmRankingTable/);
    // FarmRankingTable appears exactly once, inside the ": (" (else) arm of that ternary.
    const tableOccurrences = source.match(/<FarmRankingTable/g) ?? [];
    expect(tableOccurrences).toHaveLength(1);
  });

  it('compute-failed renders a Banner, never the table', () => {
    const source = read('farm-ranking-board.tsx');
    expect(source).toMatch(/result\.reason === 'compute-failed'/);
    expect(source).toContain('<Banner');
  });
});

describe('Optimize button — always available, and nothing but a way to the Optimizer', () => {
  // The inverse of the check this replaced. Optimize used to be hidden until a background
  // estimate vouched for it, which meant an under-reporting estimate could leave a player with
  // a worthwhile plan and no way to ask for it. There is no early return left to reinstate.
  it('renders unconditionally — no early return, and nothing that could gate the control', () => {
    const source = read('farm-optimize-button.tsx');
    expect(source).not.toMatch(/return null/);
    expect(source).not.toMatch(/shouldSurface|gate\./);
  });

  it('Optimize is the only control in its file — no objective picker, no switch', () => {
    const source = read('farm-optimize-button.tsx');
    expect(source).not.toContain('Select');
    expect(source).not.toContain('Switch');
  });

  it('the button hands the press to the host — the package owns no route and no solve', () => {
    const source = read('farm-optimize-button.tsx');
    expect(source).toMatch(/onClick=\{onOpenOptimizer\}/);
    expect(source).not.toMatch(/href|router|solve|Respec/);
  });

  it("the button reserves a min-width and takes the filter row's control-band height, bottom-aligned to it", () => {
    const source = read('farm-optimize-button.tsx');
    expect(source).toMatch(/min-w-\d+/);
    expect(source).toContain('farmFieldControlClass');
    expect(source).toContain('self-end');
  });

  it('reads no figure at all — the Optimizer screen is where the numbers are', () => {
    const source = read('farm-optimize-button.tsx');
    expect(source).not.toMatch(/paybackHours|gainPct|formatGainPct|aria-busy/);
  });

  it('the board threads the host\'s openOptimizer action straight to the button', () => {
    const source = read('farm-ranking-board.tsx');
    expect(source).toContain('openOptimizer: () => void');
    expect(source).toContain('<FarmOptimizeButton t={t} onOpenOptimizer={openOptimizer} />');
  });

  it('the board takes its rows as a prop — the host owns the subscription', () => {
    const source = read('farm-ranking-board.tsx');
    expect(source).toContain('result: FarmRankingResult');
  });

  it('the board\'s visibleRows pipeline (applyFarmFilters -> sortFarmRows) is untouched', () => {
    const source = read('farm-ranking-board.tsx');
    expect(source).toContain('applyFarmFilters(result.rows, effectiveFilters)');
    expect(source).toContain('sortFarmRows(filtered, sort.key, sort.direction)');
  });
});

describe('Farm Ranking filter row placement', () => {
  it('the filters, the return bonus, the host controls slot and the Optimize button share one row, in that order, above the table', () => {
    const source = read('farm-ranking-board.tsx');
    const poolIndex = source.indexOf('<FarmRotationPool');
    const filtersIndex = source.indexOf('<FarmRankingFilters');
    const bonusIndex = source.indexOf('<FarmReturnBonus');
    const controlsIndex = source.indexOf('{slots?.controls}');
    const buttonIndex = source.indexOf('<FarmOptimizeButton');
    const tableIndex = source.indexOf('<FarmRankingTable');
    expect(poolIndex).toBeGreaterThan(-1);
    expect(filtersIndex).toBeGreaterThan(poolIndex);
    expect(bonusIndex).toBeGreaterThan(filtersIndex);
    expect(controlsIndex).toBeGreaterThan(bonusIndex);
    expect(buttonIndex).toBeGreaterThan(controlsIndex);
    expect(tableIndex).toBeGreaterThan(buttonIndex);
  });

  it('the host controls slot is drawn bare — no wrapper for a host that passes nothing', () => {
    const source = read('farm-ranking-board.tsx');
    expect(source).toContain('{slots?.controls}');
    expect(source).not.toMatch(/<div[^>]*>\s*\{slots\?\.controls\}/);
  });

  it('FarmAuraCapField takes its label strings from the host and draws the shared chips to the filter field grid', () => {
    const source = read('farm-aura-cap-field.tsx');
    expect(source).toContain('farmFieldClass');
    expect(source).toContain('farmFieldLabelClass');
    expect(source).toContain('farmFieldControlClass');
    expect(source).not.toContain('FarmCopy');
    expect(source).not.toMatch(/\bt\.[a-z]/);
    expect(source).toContain('<InfoTip label={label} tip={hint} />');
    expect(source).toContain('<AuraCapChips');
    expect(source).not.toContain('HelpTip');
  });

  it('the filters render above the empty states, so a fully-filtered board can be un-filtered', () => {
    const source = read('farm-ranking-board.tsx');
    const filtersIndex = source.indexOf('<FarmRankingFilters');
    const emptyIndex = source.indexOf('farm-ranking-empty');
    expect(filtersIndex).toBeGreaterThan(-1);
    expect(emptyIndex).toBeGreaterThan(filtersIndex);
  });
});

describe('Farm Ranking row — the gate marker is always mounted (no-layout-shift rule 1)', () => {
  it('the gate marker renders its t.* text child unconditionally (never {cond && ...})', () => {
    const source = read('farm-ranking-row.tsx');
    expect(source).toContain('{t.farmRankingGateBadge}');
    // Visibility is toggled via `invisible` + `aria-hidden`, not conditional mounting.
    expect(source).toMatch(/!row\.gate && 'invisible'/);
    expect(source).toMatch(/aria-hidden=\{!row\.gate\}/);
  });

  it('row activation is keyboard-operable (Enter/Space) and exposes aria-current', () => {
    const source = read('farm-ranking-row.tsx');
    expect(source).toContain('tabIndex={0}');
    expect(source).toMatch(/aria-current=\{current \? 'true' : undefined\}/);
    expect(source).toMatch(/event\.key === 'Enter' \|\| event\.key === ' '/);
  });
});

describe('Farm Ranking table — the scrollport height is the host\'s to set', () => {
  it('the window size is derived per render from the height, never from a module constant', () => {
    const source = read('farm-ranking-table.tsx');
    expect(source).toContain('visibleRowsFor(scrollportHeightPx)');
    expect(source).toContain('windowFor(scrollTop, total, visibleRows)');
    expect(source).toContain('maxRows={visibleRows}');
    // The window size and the CSS height must come from one number, or the scrollport shows a
    // band the window never mounted rows for.
    expect(source).not.toMatch(/const VISIBLE_ROWS\s*=/);
    expect(source).not.toMatch(/const CONTAINER_HEIGHT_PX\s*=/);
  });

  it('a host that says nothing about its viewport gets the height the table always had', () => {
    expect(read('farm-ranking-table.tsx')).toContain(
      'scrollportHeightPx = DEFAULT_SCROLLPORT_HEIGHT_PX',
    );
  });

  it('the board threads its own optional height straight through', () => {
    const source = read('farm-ranking-board.tsx');
    expect(source).toContain('tableScrollportHeightPx?: number');
    expect(source).toContain('scrollportHeightPx={tableScrollportHeightPx}');
  });
});

/**
 * The property that lets two apps render one screen: every component here takes what it shows,
 * and reaches for nothing. Six of them used to read the web app's zustand store directly, and a
 * seventh reading one again would compile, pass every test above, and silently make the package
 * un-renderable by any host but that one.
 *
 * The walk is recursive, so a component filed into a subdirectory is covered rather than quietly
 * exempt.
 */
describe('the components are prop-driven — no store, no host module', () => {
  const HOST_REACH = [
    /\busePlannerStore\b/,
    /\bzustand\b/,
    /\buseShallow\b/,
    /from\s*'@\/[^']*'/,
    /from\s*'@bombfarm\/(web|desktop)/,
  ];

  function findHostReach(text: string): string | null {
    for (const pattern of HOST_REACH) {
      const match = pattern.exec(text);
      if (match) return match[0];
    }
    return null;
  }

  function componentFilesUnder(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? componentFilesUnder(join(dir, entry.name), `${prefix}${entry.name}/`)
        : entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
          ? [`${prefix}${entry.name}`]
          : [],
    );
  }

  const componentFiles = componentFilesUnder(COMPONENTS_DIR);

  it('red state: a fabricated usePlannerStore subscription is caught', () => {
    expect(findHostReach('const rows = usePlannerStore(selectFarmRankingRows);')).toBe(
      'usePlannerStore',
    );
  });

  it('red state: a fabricated import from the web app alias is caught', () => {
    expect(findHostReach("import { sub } from '@/shared/i18n';")).toBe("from '@/shared/i18n'");
  });

  it('the scan reaches every component in this tree, subdirectories included', () => {
    expect(componentFiles.length).toBe(22);
    expect(componentFiles).toContain('farm-ranking-board.tsx');
    expect(componentFiles).toContain('farm-aura-cap-field.tsx');
    expect(componentFiles).toContain('combat-phase-panel.tsx');
    expect(componentFiles).toContain('farm-optimize-button.tsx');
    expect(componentFiles).toContain('phases-explorer.tsx');
  });

  it('green state: no component reads a store or imports a host module', () => {
    const offenders = componentFiles
      .map((name) => ({ name, hit: findHostReach(read(name)) }))
      .filter((entry) => entry.hit);
    expect(offenders, offenders.map((o) => `${o.name}: ${o.hit}`).join('\n')).toEqual([]);
  });
});
