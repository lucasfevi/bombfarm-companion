import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { buildInventoryView, type InventoryView } from '@bombfarm/domain/inventory-view';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { HomeStatusStrip } from '@/features/home/components/home-status-strip';
import { STRINGS, sub, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

let inventoryView: InventoryView | null = null;

vi.mock('@/features/home/model/use-inventory-view-snapshot', () => ({
  useInventoryViewSnapshot: () => inventoryView,
}));

const LANGS: readonly Lang[] = ['en', 'pt'];
const NOW = Date.UTC(2026, 8, 13, 12, 0, 0);
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const SAVE_WITH_221_ITEMS = join(
  WEB_PACKAGE_ROOT,
  '../../packages/domain/tests/fixtures/sheet-math/save-20260823-13heroes-crit-points.json',
);

function savedInventoryView(): InventoryView {
  const raw = JSON.parse(readFileSync(SAVE_WITH_221_ITEMS, 'utf8')) as { items: unknown[] };
  return buildInventoryView(raw.items);
}

function hero(id: string, updatedAt = 1) {
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt,
    rarity: 'Raro',
    level: 20,
    stars: 0,
    naked: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    gearedOverride: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
  });
}

const heroes = (count: number, updatedAt = 1) =>
  Array.from({ length: count }, (_, index) => hero(`h${index}`, updatedAt));

const render = () => renderToStaticMarkup(createElement(HomeStatusStrip));

function stripText(html: string): string {
  const start = html.indexOf('data-testid="home-status-strip-text"');
  return html.slice(html.indexOf('>', start) + 1, html.indexOf('</p>', start));
}

const unknownIdentity = (lang: Lang) =>
  `${STRINGS[lang].homeStripPlayerUnknown} · ${STRINGS[lang].homeStripAccountIdUnknown}`;

describe('the front page status strip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    resetPlannerStoreForTests();
    inventoryView = null;
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.useRealTimers();
  });

  it('reads Unknown player and no account id when the export carried neither', () => {
    usePlannerStore.setState({ heroes: heroes(3), playerName: null, accountId: null, importedAt: NOW });
    inventoryView = savedInventoryView();

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];

      expect(stripText(render())).toBe(
        [
          unknownIdentity(lang),
          sub(strings.homeStripHeroes, { count: 3 }),
          sub(strings.homeStripItems, { count: 221 }),
          sub(strings.homeStripImported, { age: strings.marketAgeJustNow }),
        ].join(' · '),
      );
    }

    const html = render();
    const source = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/home/components/home-status-strip.tsx'),
      'utf8',
    );
    expect(html).toContain('data-testid="home-status-strip"');
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain(`>${STRINGS.pt.homeStripImport}</button>`);
    expect(source).toContain('usePlannerStore((state) => state.openImportDialog)');
    expect(source.match(/onClick=/g)).toEqual(['onClick=']);
    expect(source).toContain('onClick={openImportDialog}');
  });

  it('shortens a long account id to its first and last four characters and leaves a short one whole', () => {
    usePlannerStore.setState({ playerName: 'Kendo', accountId: '1234567890' });
    expect(stripText(render()).startsWith('Kendo · 1234567890 · ')).toBe(true);

    usePlannerStore.setState({ accountId: '76561198012345678' });
    expect(stripText(render()).startsWith('Kendo · 7656…5678 · ')).toBe(true);
  });

  it("reads 'import date not recorded' when the account has no import stamp", () => {
    usePlannerStore.setState((state) => ({
      heroes: heroes(2, NOW - 3 * DAY_MS),
      importedAt: null,
      inventory: { ...state.inventory, importedAt: NOW - 90 * 1000 },
    }));
    inventoryView = savedInventoryView();

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const text = stripText(render());

      expect(text.endsWith(` · ${STRINGS[lang].homeStripImportedUnknown}`)).toBe(true);
      expect(text).not.toContain(STRINGS[lang].homeStripImported.split('{')[0]);
    }
  });

  it("reads 'save imported 1 min ago' at ninety seconds and '3 d ago' at three days", () => {
    usePlannerStore.setState({ lang: 'en', importedAt: NOW - 90 * 1000 });
    expect(stripText(render()).endsWith(' · save imported 1 min ago')).toBe(true);

    usePlannerStore.setState({ importedAt: NOW - 3 * DAY_MS });
    expect(stripText(render()).endsWith(' · save imported 3 d ago')).toBe(true);

    usePlannerStore.setState({ lang: 'pt' });
    expect(stripText(render()).endsWith(' · save importado há 3 d')).toBe(true);
  });

  it('counts the heroes in the store and the rows in the stored inventory view', () => {
    usePlannerStore.setState({ lang: 'en', heroes: heroes(13), importedAt: null });

    expect(stripText(render())).toBe(
      'Unknown player · no account id · 13 heroes · import date not recorded',
    );

    inventoryView = savedInventoryView();
    expect(stripText(render())).toBe(
      'Unknown player · no account id · 13 heroes · 221 items · import date not recorded',
    );
  });
});
