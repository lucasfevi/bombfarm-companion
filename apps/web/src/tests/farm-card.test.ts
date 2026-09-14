import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { formatPhaseCoord, gameDifficultyLabel, phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { formatBand, formatRatePerHour } from '@bombfarm/farm/model/farm-ranking-format';
import { formatClearTime } from '@bombfarm/hero/model';
import { FarmCard } from '@/features/home/components/farm-card';
import { farmCardViewFrom, type FarmCardView } from '@/features/home/model/farm-card-view';
import { buildFarmSentence, formatSignedPct } from '@/features/home/model/farm-sentence';
import { STRINGS, sub, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import {
  resetPlannerStoreForTests,
  selectFarmBoardRows,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

let viewOverride: FarmCardView | null = null;

vi.mock('@/features/home/model/farm-card-view', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/home/model/farm-card-view')>();
  return {
    ...real,
    selectFarmCardRows: (state: PlannerStore) => viewOverride ?? real.selectFarmCardRows(state),
  };
});

const LANGS: readonly Lang[] = ['en', 'pt'];

/**
 * One row the board itself computed — feasible, unlocked and non-gated. A domain guard forbids
 * the bare one-shot column name outside its allowlist, so the fixtures inherit every field from
 * a real row rather than spelling them out here.
 */
function boardRow(): FarmRateRow {
  usePlannerStore.getState().hydrateRoster([hero('a'), hero('b')], 'a');
  usePlannerStore.getState().applyAccountImport({ tree: null, houseIdx: 0, houseLevel: 5, phase: 51, maxPhase: 137 });
  const base = selectFarmBoardRows(usePlannerStore.getState()).rows.find(
    (candidate) => !candidate.locked && !candidate.infeasible && !candidate.gate,
  );
  resetPlannerStoreForTests();
  if (base == null) throw new Error('the board computed no usable row');
  return base;
}

const BASE = boardRow();

const row = (overrides: Partial<FarmRateRow> & { phase: number }): FarmRateRow => ({
  ...BASE,
  clearSecs: 60,
  itemLevels: [10],
  itemLevelLabel: '10',
  ...overrides,
});

function hero(id: string) {
  const stats = { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 };
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: stats,
    gearedOverride: stats,
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: true,
  });
}

/** A gated current phase, a best phase that pays more, and a locked phase that beats them both. */
const CURRENT = row({
  phase: 10,
  ato: 2,
  gate: true,
  goldPerHour: 1200,
  xpPerHour: 34_500,
  itemLevels: [10, 12],
  itemLevelLabel: '10–12',
  clearSecs: 95,
});
const BEST = row({
  phase: 30,
  ato: 2,
  goldPerHour: 3000,
  xpPerHour: 51_000,
  itemLevels: [14],
  itemLevelLabel: '14',
  clearSecs: 62,
});
const LOCKED = row({ phase: 50, goldPerHour: 4800, locked: true });
const GATE = row({ phase: 150, ato: 2, gate: true, goldPerHour: 100, locked: true, infeasible: true });
const NEXT_LEVEL = row({ phase: 101, ato: 2, goldPerHour: 2700, itemLevels: [14, 16], itemLevelLabel: '14–16', locked: true });
const NEXT_ATO = row({ phase: 151, ato: 3, goldPerHour: 600, itemLevels: [20], itemLevelLabel: '20', locked: true });

function usableAccount(): void {
  usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
  usePlannerStore.setState({ phase: 10, maxPhase: 137, missingRequiredFields: [] });
}

const escaped = (text: string) => text.replace(/'/g, '&#x27;');
const render = () => renderToStaticMarkup(createElement(FarmCard));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');
const openingOf = (html: string, testId: string) =>
  html.lastIndexOf('<div', html.indexOf(`data-testid="${testId}"`));
const body = (html: string) =>
  html.slice(openingOf(html, 'home-card-body'), openingOf(html, 'home-card-footer'));
const footerLines = (html: string) =>
  [...html.slice(openingOf(html, 'home-card-footer')).matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map(
    (match) => match[1],
  );
const slot = (html: string, testId: string) =>
  new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? null;
const tag = (html: string, testId: string) =>
  html.slice(html.lastIndexOf('<', html.indexOf(`data-testid="${testId}"`)), html.indexOf('>', html.indexOf(`data-testid="${testId}"`)) + 1);
const cellText = (html: string, testId: string, tagName: 'td' | 'th') => {
  const at = html.indexOf(`data-testid="${testId}"`);
  return textOf(html.slice(html.indexOf('>', at) + 1, html.indexOf(`</${tagName}>`, at)));
};
const barWidths = (html: string) => [...html.matchAll(/style="width:([^"]+)"/g)].map((match) => match[1]);

describe('the front page farm card', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    viewOverride = null;
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    viewOverride = null;
  });

  it("four aligned columns print the board's own figures, labelled, with the best column tinted and the locked one dimmed", () => {
    usableAccount();
    viewOverride = farmCardViewFrom([CURRENT, BEST, NEXT_LEVEL, GATE, NEXT_ATO], 10);

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="ready"');
      expect(html).toContain(`>${strings.homeCardFarmContext}<`);
      for (const key of ['homeCardFarmRowGold', 'homeCardFarmRowXp', 'homeCardFarmRowItemLevels', 'homeCardFarmRowClearTime', 'homeCardFarmRowVs'] as const) {
        expect(textOf(html)).toContain(strings[key]);
      }
      const titles = ['current', 'best', 'nextItemLevel', 'nextDifficulty'].map((id) => cellText(html, `home-farm-${id}-title`, 'th'));
      expect(titles).toEqual([
        strings.homeCardFarmCurrent,
        strings.homeCardFarmBest,
        strings.homeCardFarmNextItemLevel,
        strings.homeCardFarmNextDifficulty,
      ]);

      for (const [id, tile] of [
        ['current', CURRENT],
        ['best', BEST],
        ['nextItemLevel', NEXT_LEVEL],
        ['nextDifficulty', NEXT_ATO],
      ] as const) {
        expect(slot(html, `home-farm-${id}-phase`)).toBe(formatPhaseCoord(tile.phase, lang));
        expect(html).toContain(`>${phaseMapDisplayName(tile.phase, lang)}<`);
        expect(slot(html, `home-farm-${id}-gold`)).toBe(formatRatePerHour(tile.goldPerHour, lang));
        expect(slot(html, `home-farm-${id}-xp`)).toBe(formatRatePerHour(tile.xpPerHour, lang));
        expect(slot(html, `home-farm-${id}-items`)).toBe(formatBand(tile.itemLevelLabel));
        expect(slot(html, `home-farm-${id}-clear`)).toBe(formatClearTime(tile.clearSecs));
      }
      expect(html).not.toContain(`>${gameDifficultyLabel(CURRENT.ato, lang)}<`);
      expect(barWidths(html)).toEqual(['40%', '100%', '90%', '20%']);
      expect(tag(html, 'home-farm-best-title')).toContain('text-accent');
      expect(tag(html, 'home-farm-nextDifficulty-phase')).toContain('text-muted');
      expect(tag(html, 'home-farm-current-phase')).toContain('text-ink');
      expect((html.match(new RegExp(`>${strings.homeCardFarmLocked}<`, 'g')) ?? []).length).toBe(2);
    }
  });

  it('the vs row states each comparison against its own basis, and the notes carry the drop change and the gate', () => {
    usableAccount();
    viewOverride = farmCardViewFrom([CURRENT, BEST, NEXT_LEVEL, GATE, NEXT_ATO], 10);

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();
      const vs = (id: string) => cellText(html, `home-farm-${id}-vs`, 'td');

      expect(vs('current')).toBe(strings.homeCardFarmHere);
      expect(vs('best')).toBe(`${formatSignedPct(150, lang)}${strings.homeCardFarmVsCurrent}`);
      expect(vs('nextItemLevel')).toBe(`${formatSignedPct(-10, lang)}${strings.homeCardFarmVsBest}`);
      expect(vs('nextDifficulty')).toBe(`${formatSignedPct(-50, lang)}${strings.homeCardFarmVsCurrent}`);
      expect(tag(html, 'home-farm-best-vs').length).toBeGreaterThan(0);
      expect(html.slice(html.indexOf('home-farm-best-vs'))).toContain('data-tone="up"');

      const notes = [...html.matchAll(/data-testid="home-farm-note"[^>]*>([^<]*)</g)].map((match) => match[1]);
      expect(notes).toEqual([
        `${sub(strings.homeCardFarmSentenceLead, { phase: strings.homeCardFarmBest, rest: (buildFarmSentence(viewOverride.sentence, strings) ?? '').slice(0, -1) })}.`,
        escaped(sub(strings.homeCardFarmLockedReach, { phase: formatPhaseCoord(101, lang) })),
        escaped(sub(strings.homeCardFarmLockedGateCannot, { phase: formatPhaseCoord(151, lang), gate: 150 })),
      ]);
      expect(viewOverride.sentence.map((fragment) => fragment.kind)).toEqual(['ahead', 'clearFaster', 'dropsSwap']);
    }
  });

  it('with no next item level and no next difficulty the table has two columns and the notes say nothing about them', () => {
    usableAccount();
    const top = row({ phase: 451, ato: 5, goldPerHour: 1000, itemLevels: [99], itemLevelLabel: '99' });
    viewOverride = farmCardViewFrom([top], 451);
    usePlannerStore.setState({ lang: 'en' });
    const html = render();

    expect(html).toContain('data-testid="home-farm-best-title"');
    expect(html).not.toContain('home-farm-nextItemLevel');
    expect(html).not.toContain('home-farm-nextDifficulty');
    expect(html).not.toContain('home-farm-note');
  });

  it('the best column says you are on it when the phases match, and the pill turns down when current pays more', () => {
    usableAccount();
    viewOverride = farmCardViewFrom([CURRENT, BEST], 30);
    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();
      const bestVs = cellText(html, 'home-farm-best-vs', 'td');
      expect(bestVs).toBe(escaped(STRINGS[lang].homeCardFarmSame));
      expect(html).not.toContain('home-farm-note');
      expect(slot(html, 'home-farm-current-gold')).toBe(slot(html, 'home-farm-best-gold'));
    }

    viewOverride = farmCardViewFrom(
      [row({ phase: 10, goldPerHour: 1200, infeasible: true }), row({ phase: 30, goldPerHour: 600 })],
      10,
    );
    usePlannerStore.setState({ lang: 'en' });
    const html = render();
    expect(html.slice(html.indexOf('home-farm-best-vs'))).toContain('data-tone="down"');
    expect(html.slice(html.indexOf('home-farm-best-vs'))).toContain('>−50.0%<');
  });

  it('the footer names a push target only when a locked phase would pay more', () => {
    usableAccount();
    usePlannerStore.setState({ lang: 'en' });

    viewOverride = farmCardViewFrom([CURRENT, BEST, LOCKED], 10);
    expect(footerLines(render())).toEqual([
      STRINGS.en.homeCardFarmFooterRanked,
      sub(STRINGS.en.homeCardFarmFooterPush, { phase: 50, pct: '60.0' }),
      `${STRINGS.en.farmRankingReturnBonusLabel} ${STRINGS.en.farmRankingReturnBonusOff}`,
    ]);

    viewOverride = farmCardViewFrom([CURRENT, BEST, row({ phase: 50, goldPerHour: 3000, locked: true })], 10);
    expect(footerLines(render())).toEqual([
      STRINGS.en.homeCardFarmFooterRanked,
      `${STRINGS.en.farmRankingReturnBonusLabel} ${STRINGS.en.farmRankingReturnBonusOff}`,
    ]);

    usePlannerStore.setState({ lang: 'pt' });
    expect(footerLines(render())[0]).toBe(STRINGS.pt.homeCardFarmFooterRanked);
  });

  it("the last footer line is the board's Return Bonus label and value", () => {
    usableAccount();
    viewOverride = farmCardViewFrom([CURRENT, BEST], 10);

    for (const [mode, key] of [
      ['off', 'farmRankingReturnBonusOff'],
      ['on', 'farmRankingReturnBonusOn'],
      ['vip', 'farmRankingReturnBonusVip'],
    ] as const) {
      usePlannerStore.getState().setFarmReturnBonus(mode);
      for (const lang of LANGS) {
        usePlannerStore.setState({ lang });
        const lines = footerLines(render());
        expect(lines[lines.length - 1]).toBe(
          `${STRINGS[lang].farmRankingReturnBonusLabel} ${STRINGS[lang][key]}`,
        );
      }
    }
  });

  it('without a usable account the card is in its needs state and prints no phase number from any source', () => {
    const expectNeeds = (html: string, lang: Lang) => {
      expect(html).toContain('data-home-card-state="needs"');
      expect(textOf(body(html))).toBe('');
      expect(body(html)).not.toMatch(/#\d/);
      expect(textOf(html.slice(openingOf(html, 'home-card-footer')))).toBe(
        escaped(STRINGS[lang].homeCardFarmNeeds),
      );
    };

    expect(textOf(render().slice(openingOf(render(), 'home-card-footer')))).toBe('');

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang, phase: 51 });
      expectNeeds(render(), lang);
    }

    usableAccount();
    usePlannerStore.setState({ lang: 'en', maxPhase: null });
    viewOverride = farmCardViewFrom([CURRENT, BEST], 10);
    expectNeeds(render(), 'en');

    usePlannerStore.setState({ maxPhase: 137, missingRequiredFields: ['tree'] });
    expectNeeds(render(), 'en');

    usePlannerStore.setState({ missingRequiredFields: [] });
    viewOverride = farmCardViewFrom([CURRENT, BEST], 999);
    expectNeeds(render(), 'en');

    viewOverride = farmCardViewFrom([row({ phase: 10, goldPerHour: 100, infeasible: true }), LOCKED], 10);
    expectNeeds(render(), 'en');

    viewOverride = null;
    usePlannerStore.setState({ heroes: [] });
    expectNeeds(render(), 'en');
  });

  it('reads every figure off the board rows and imports no farm-rate module', () => {
    for (const file of ['farm-card.tsx', 'farm-comparison-table.tsx']) {
      const source = readFileSync(join(WEB_PACKAGE_ROOT, 'src/features/home/components', file), 'utf8');
      const specifiers = Array.from(source.matchAll(/from '([^']+)'/g), (match) => match[1]);

      expect(specifiers.length).toBeGreaterThan(0);
      expect(specifiers.filter((specifier) => specifier.includes('farm-rate'))).toEqual([]);
    }
    const cardSource = readFileSync(join(WEB_PACKAGE_ROOT, 'src/features/home/components/farm-card.tsx'), 'utf8');
    expect(cardSource).toContain('usePlannerStore(selectFarmCardRows)');
  });
});
