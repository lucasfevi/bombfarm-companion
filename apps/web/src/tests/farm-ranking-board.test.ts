import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FARM_COLUMNS } from '@/features/phases/model/farm-ranking-view';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * Structural (source-scanning) coverage for the board's presentational components.
 *
 * Deviation from a component-test idiom: the planned coverage named "unit (existing apps/web component-test
 * idiom)" for this layer. There is no such idiom in this repo — zero `*.test.tsx` files exist
 * anywhere under `apps/web/src`, and neither `apps/web/package.json` nor `packages/ui/package.json`
 * carries `jsdom` or `@testing-library/react`. Adding either would be a new dependency, which
 * the "package.json dependency list is unchanged" gate forbids introducing
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
    ['src/features/phases/components/farm-ranking-filters.tsx', 'farm-filter-ato'],
    ['src/features/phases/components/farm-ranking-filters.tsx', 'farm-filter-gate'],
    ['src/features/phases/components/farm-ranking-filters.tsx', 'farm-filter-item-level'],
    ['src/features/phases/components/farm-rotation-pool.tsx', 'farm-pool'],
    ['src/features/phases/components/farm-return-bonus.tsx', 'farm-return-bonus'],
    ['src/features/phases/components/farm-ranking-table.tsx', 'farm-ranking-table'],
    ['src/features/phases/components/farm-ranking-table.tsx', 'farm-sort-live'],
    ['src/features/phases/components/farm-respec-toolbar.tsx', 'farm-respec-toolbar'],
    ['src/features/phases/components/farm-respec-toolbar.tsx', 'farm-respec-optimize'],
    ['src/features/phases/components/farm-respec-headline.tsx', 'farm-respec-headline'],
    ['src/features/phases/components/farm-respec-panel.tsx', 'farm-respec-panel'],
    ['src/features/phases/components/farm-respec-panel.tsx', 'farm-respec-close'],
    ['src/features/phases/components/farm-respec-metrics.tsx', 'farm-respec-metrics'],
    ['src/features/phases/components/farm-respec-metrics.tsx', 'farm-respec-metric-gold'],
    ['src/features/phases/components/farm-respec-metrics.tsx', 'farm-respec-metric-chests'],
    ['src/features/phases/components/farm-respec-metrics.tsx', 'farm-respec-metric-phase'],
    ['src/features/phases/components/farm-respec-metrics.tsx', 'farm-respec-metric-cost'],
    ['src/features/phases/components/farm-respec-metrics.tsx', 'farm-respec-metric-payback'],
    ['src/features/phases/components/farm-respec-hero-grid.tsx', 'farm-respec-heroes'],
    ['src/features/phases/components/farm-respec-frontier.tsx', 'farm-respec-frontier'],
    ['src/features/phases/components/farm-respec-rerank-toggle.tsx', 'farm-respec-rerank'],
  ];

  it('farm-respec-frontier.tsx declares a per-hero-count testid template', () => {
    expect(read('src/features/phases/components/farm-respec-frontier.tsx')).toContain(
      'farm-respec-frontier-${entry.heroCount}',
    );
  });

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

describe('Farm Ranking board — the four empty states render no numeric cell', () => {
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

describe('Farm Respec Advisor toolbar — visibility, controls and layout stability', () => {
  it('renders nothing below the gain threshold and when the gate has no roster/heroes-enabled reason — the early return exists', () => {
    const source = read('src/features/phases/components/farm-respec-toolbar.tsx');
    expect(source).toMatch(/if \(!degraded && !gate\.shouldSurface\) return null;/);
  });

  it('no objective picker remains — Optimize is the only control in the toolbar', () => {
    const source = read('src/features/phases/components/farm-respec-toolbar.tsx');
    expect(source).not.toContain('Select');
    expect(source).not.toContain('setFarmObjective');
  });

  it('Optimize is a real button with aria-busy, aria-expanded and aria-controls pointing at the panel', () => {
    const source = read('src/features/phases/components/farm-respec-toolbar.tsx');
    expect(source).toMatch(/aria-busy=\{busy\}/);
    expect(source).toMatch(/aria-expanded=\{panelOpen\}/);
    expect(source).toContain('aria-controls="farm-respec-panel"');
  });

  it('the Optimize button reserves a min-width so the busy transition does not reflow the toolbar', () => {
    const source = read('src/features/phases/components/farm-respec-toolbar.tsx');
    expect(source).toMatch(/className="min-w-\d+"/);
  });

  it('the only visibility input is the gate\'s own shouldSurface flag — nothing here reads the payback duration', () => {
    const source = read('src/features/phases/components/farm-respec-toolbar.tsx');
    expect(source).not.toMatch(/paybackHours/);
  });

  it('the gate-failed reason renders a named degraded note, with Optimize still enabled', () => {
    const source = read('src/features/phases/components/farm-respec-toolbar.tsx');
    expect(source).toContain("gate.reason === 'gate-failed'");
    expect(source).toContain('{t.farmRespecGateFailed}');
  });

  it('subscribes via usePlannerStore(selectFarmRespecGate) without useShallow', () => {
    const source = read('src/features/phases/components/farm-respec-toolbar.tsx');
    expect(source).toContain('usePlannerStore(selectFarmRespecGate)');
    expect(source).not.toMatch(/useShallow\([^)]*selectFarmRespecGate/);
  });

  // The headline is the lower-bound gain and nothing else — the phase, the cost and the payback
  // are the panel's metric tiles now, not four facts crammed into one toolbar line.
  it('the headline shows the lower-bound gain alone', () => {
    const source = read('src/features/phases/components/farm-respec-headline.tsx');
    expect(source).toContain('t.farmRespecHeadlineGain');
    expect(source).not.toMatch(/formatPhaseLabel|formatGold|formatHours|resolvePaybackKind/);
  });
});

describe('Farm Respec Advisor panel — in-place expansion and banners', () => {
  it('is a plain <section> in normal flow — no role="dialog", no portal', () => {
    const source = read('src/features/phases/components/farm-respec-panel.tsx');
    expect(source).toMatch(/<section[\s\S]*?id="farm-respec-panel"/);
    expect(source).not.toMatch(/role=["']dialog["']/);
    expect(source).not.toContain('Portal');
  });

  it('mounts only when a fresh view exists or status is solving/failed, AND the panel is open', () => {
    const source = read('src/features/phases/components/farm-respec-panel.tsx');
    expect(source).toMatch(
      /const mountable = panelOpen && \(view != null \|\| status === 'solving' \|\| status === 'failed'\);/,
    );
  });

  it('the failed state renders a named banner with zero numeric cells and no re-rank toggle', () => {
    const source = read('src/features/phases/components/farm-respec-panel.tsx');
    expect(source).toContain("panelState.kind === 'failed'");
    expect(source).toContain('farm-respec-failed-banner');
    expect(source).not.toContain('Switch');
  });

  it('the budget-exhausted banner renders ABOVE the metric tiles', () => {
    const source = read('src/features/phases/components/farm-respec-panel.tsx');
    const bannerIndex = source.indexOf('farm-respec-budget-exhausted');
    const tilesIndex = source.indexOf('<FarmRespecMetrics');
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(tilesIndex).toBeGreaterThan(bannerIndex);
  });

  it('winningSeed is never rendered anywhere in the panel or its children', () => {
    for (const file of [
      'src/features/phases/components/farm-respec-panel.tsx',
      'src/features/phases/components/farm-respec-metrics.tsx',
    ]) {
      expect(read(file)).not.toMatch(/winningSeed/);
    }
  });

  it('no component under this task has a try/catch of its own', () => {
    for (const file of [
      'src/features/phases/components/farm-respec-panel.tsx',
      'src/features/phases/components/farm-respec-metrics.tsx',
    ]) {
      expect(read(file)).not.toMatch(/\btry\s*\{/);
    }
  });

  // The energy-allocation section is gone entirely — bar first, then the sentence. Nothing in
  // the panel reads `result.plateau` any more; this pins that so it cannot creep back untested.
  it('the panel renders no energy-allocation section', () => {
    const source = read('src/features/phases/components/farm-respec-panel.tsx');
    expect(source).not.toMatch(/[Pp]lateau/);
  });

  it('the panel has a real heading wired via aria-labelledby, and a close button that closes it', () => {
    const source = read('src/features/phases/components/farm-respec-panel.tsx');
    expect(source).toMatch(/aria-labelledby=\{PANEL_HEADING_ID\}/);
    expect(source).toContain('setFarmRespecPanelOpen(false)');
  });
});

describe('Farm Respec Advisor hero cards — full target allocations, luck kept, unchanged still shown', () => {
  it('the card testid and per-key testid templates are declared', () => {
    const source = read('src/features/phases/components/farm-respec-hero-card.tsx');
    expect(source).toContain('farm-respec-hero-${entry.heroId}');
    expect(source).toContain('farm-respec-key-${entry.heroId}-${row.key}');
  });

  // The grid renders two groups now (changed heroes, then unchanged), so it no longer maps
  // `result.heroes` directly. The invariant this guarded — no hero is dropped — is proved
  // against `partitionHeroEntries` itself in farm-respec-view.test.ts, which is stronger than
  // scanning for an absent `.filter(`; what is left to assert here is that BOTH groups render.
  it('the grid renders both hero groups — never only the changed ones', () => {
    const source = read('src/features/phases/components/farm-respec-hero-grid.tsx');
    expect(source).toContain('partitionHeroEntries(result)');
    expect(source).toMatch(/groups\.changed\.map\(/);
    expect(source).toMatch(/groups\.unchanged\.map\(/);
    expect(source).not.toMatch(/result\.heroes\.filter\(/);
  });

  it('the grid uses an auto-fit/minmax responsive layout — never an accordion, tab list or horizontal scroller', () => {
    const source = read('src/features/phases/components/farm-respec-hero-grid.tsx');
    expect(source).toContain('auto-fit');
    expect(source).toContain('minmax');
    expect(source).not.toMatch(/Accordion|role="tablist"|overflow-x/);
  });

  it('identity is rendered by HeroIdentityChip imported from @/shared/game-art — no second identity component under features/phases', () => {
    const cardSource = read('src/features/phases/components/farm-respec-hero-card.tsx');
    expect(cardSource).toMatch(/import\s*\{[^}]*HeroIdentityChip[^}]*\}\s*from\s*'@\/shared\/game-art'/);
  });

  it('the changed-hero table passes current, target and change to the shared DeltaTable ledger, chronological order (current before target)', () => {
    const source = read('src/features/phases/components/farm-respec-hero-card.tsx');
    expect(source).toContain('t.farmRespecKeyCurrent');
    expect(source).toContain('t.farmRespecKeyTarget');
    expect(source).toContain('t.farmRespecKeyDelta');
    expect(source).toContain('row.target');
    expect(source).toContain('row.current');
    expect(source.indexOf('t.farmRespecKeyCurrent')).toBeLessThan(source.indexOf('t.farmRespecKeyTarget'));
  });

  it('the luck row is locked, carrying the same hint text through DeltaTable\'s lock glyph', () => {
    const source = read('src/features/phases/components/farm-respec-hero-card.tsx');
    expect(source).toContain('locked: row.keep');
    expect(source).toContain('t.farmRespecLuckKeep');
    expect(source).toContain('t.farmRespecLuckHint');
  });

  it('an unchanged hero renders de-emphasized, never hidden outright', () => {
    const source = read('src/features/phases/components/farm-respec-hero-card.tsx');
    expect(source).toContain('!entry.changed');
    expect(source).not.toMatch(/display:\s*none/);
  });

  // The note and the gold saved are stated once for the whole group, not per card — repeated on
  // every card they were the same sentence several times over, and the amounts were a total the
  // player had to sum themselves.
  it('the unchanged group states its note once, over the summed gold from the domain', () => {
    const grid = read('src/features/phases/components/farm-respec-hero-grid.tsx');
    expect(grid).toContain('t.farmRespecUnchangedGroupNote');
    expect(grid).toContain('result.unchangedRespecCostGold');
    const card = read('src/features/phases/components/farm-respec-hero-card.tsx');
    expect(card).not.toMatch(/farmRespecUnchanged/);
  });

  it('no move is annotated as optional/negligible/minor/skippable at any magnitude — no conditional class keyed on delta size', () => {
    const source = read('src/features/phases/components/farm-respec-hero-card.tsx');
    expect(source).not.toMatch(/negligible|\boptional\b|\bskip(pable)?\b/i);
    expect(source).not.toMatch(/row\.delta\s*[<>=]/);
  });
});

describe('Farm Respec Advisor frontier — cost-ascending, never re-sorted locally', () => {
  it('renders one row per result.frontier entry, in the array\'s own order — no local sort/filter/reverse', () => {
    const source = read('src/features/phases/components/farm-respec-frontier.tsx');
    expect(source).toContain('resolveFrontierEntries(result)');
    expect(source).toMatch(/entries\.map\(/);
    expect(source).not.toMatch(/entries\.(sort|filter|reverse)\(/);
  });

  it('an empty frontier is omitted — the model\'s null signal is respected, not mapped over as an empty list', () => {
    const source = read('src/features/phases/components/farm-respec-frontier.tsx');
    expect(source).toMatch(/if \(entries == null\) return null;/);
  });
});

describe('Farm Respec Advisor re-rank toggle and mode marking', () => {
  it('the toggle is always mounted above the table, not gated inside the collapsible panel', () => {
    const boardSource = read('src/features/phases/components/farm-ranking-board.tsx');
    const panelSource = read('src/features/phases/components/farm-respec-panel.tsx');
    expect(boardSource).toContain('<FarmRespecRerankToggle');
    expect(panelSource).not.toContain('FarmRespecRerankToggle');
  });

  it('reading selectFarmReRankActive means the toggle has no staleness logic of its own', () => {
    const source = read('src/features/phases/components/farm-respec-rerank-toggle.tsx');
    expect(source).toContain('usePlannerStore(selectFarmReRankActive)');
  });

  it('the toggle renders nothing until a fresh proposal exists — gated on selectFarmRespecView', () => {
    const source = read('src/features/phases/components/farm-respec-rerank-toggle.tsx');
    expect(source).toContain('usePlannerStore(selectFarmRespecView)');
    expect(source).toMatch(/if \(!hasProposal\) return null;/);
    expect(source).not.toContain('state.farmRespecPanelOpen');
  });

  it('re-rank mode is marked three independent, non-colour ways: an always-mounted Banner, the sr-only caption, and a data-farm-mode attribute', () => {
    const toggleSource = read('src/features/phases/components/farm-respec-rerank-toggle.tsx');
    const tableSource = read('src/features/phases/components/farm-ranking-table.tsx');
    expect(toggleSource).toContain('<Banner');
    expect(tableSource).toContain('reRankActive ? t.farmRespecRerankCaption : t.farmRankingCaption');
    expect(tableSource).toMatch(/data-farm-mode=\{reRankActive \? 'proposed' : 'current'\}/);
  });

  it('farm-ranking-table.tsx gains reRankActive with no column, sort or filter semantic change (sortKey/sortDir are regrouped into one sort prop only to stay under the 8-prop cap)', () => {
    const source = read('src/features/phases/components/farm-ranking-table.tsx');
    expect(source).toContain('reRankActive: boolean');
    expect(source).not.toMatch(/FARM_COLUMNS\s*=/); // the shipped column list itself is not reassigned/edited
  });

  it('the board subscribes via selectFarmBoardRows, without useShallow', () => {
    const source = read('src/features/phases/components/farm-ranking-board.tsx');
    expect(source).toContain('usePlannerStore(selectFarmBoardRows)');
    expect(source).not.toMatch(/useShallow\([^)]*selectFarmBoardRows/);
  });

  it('the board\'s visibleRows pipeline (applyFarmFilters -> sortFarmRows) is untouched — only the row source changed', () => {
    const source = read('src/features/phases/components/farm-ranking-board.tsx');
    expect(source).toContain('applyFarmFilters(result.rows, effectiveFilters)');
    expect(source).toContain('sortFarmRows(filtered, sort.key, sort.direction)');
  });
});

describe('Farm Respec Advisor toolbar/panel wiring', () => {
  it('the board renders the toolbar between the pool and the table', () => {
    const source = read('src/features/phases/components/farm-ranking-board.tsx');
    const poolIndex = source.indexOf('<FarmRotationPool');
    const toolbarIndex = source.indexOf('<FarmRespecToolbar');
    const tableIndex = source.indexOf('<FarmRankingTable');
    expect(poolIndex).toBeGreaterThan(-1);
    expect(toolbarIndex).toBeGreaterThan(poolIndex);
    expect(tableIndex).toBeGreaterThan(toolbarIndex);
  });
});

describe('Farm Ranking filter row placement', () => {
  it('the filters sit below the respec toolbar and above the table', () => {
    const source = read('src/features/phases/components/farm-ranking-board.tsx');
    const toolbarIndex = source.indexOf('<FarmRespecToolbar');
    const filtersIndex = source.indexOf('<FarmRankingFilters');
    const tableIndex = source.indexOf('<FarmRankingTable');
    expect(filtersIndex).toBeGreaterThan(toolbarIndex);
    expect(tableIndex).toBeGreaterThan(filtersIndex);
  });

  it('the filters render above the empty states, so a fully-filtered board can be un-filtered', () => {
    const source = read('src/features/phases/components/farm-ranking-board.tsx');
    const filtersIndex = source.indexOf('<FarmRankingFilters');
    const emptyIndex = source.indexOf('farm-ranking-empty');
    expect(filtersIndex).toBeGreaterThan(-1);
    expect(emptyIndex).toBeGreaterThan(filtersIndex);
  });
});

describe('Farm Ranking row — the gate marker is always mounted (no-layout-shift rule 1)', () => {
  it('the gate marker renders its t.* text child unconditionally (never {cond && ...})', () => {
    const source = read('src/features/phases/components/farm-ranking-row.tsx');
    expect(source).toContain('{t.farmRankingGateBadge}');
    // Visibility is toggled via `invisible` + `aria-hidden`, not conditional mounting.
    expect(source).toMatch(/!row\.gate && 'invisible'/);
    expect(source).toMatch(/aria-hidden=\{!row\.gate\}/);
  });

  it('row activation is keyboard-operable (Enter/Space) and exposes aria-current', () => {
    const source = read('src/features/phases/components/farm-ranking-row.tsx');
    expect(source).toContain('tabIndex={0}');
    expect(source).toMatch(/aria-current=\{current \? 'true' : undefined\}/);
    expect(source).toMatch(/event\.key === 'Enter' \|\| event\.key === ' '/);
  });
});
