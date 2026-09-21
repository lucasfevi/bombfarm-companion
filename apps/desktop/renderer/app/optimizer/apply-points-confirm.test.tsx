import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import {
  ApplyPointsConfirmRows,
  initialPointsSelection,
  isPointsConfirmHeroSelectable,
  pointsSelectionGold,
  type ApplyPointsConfirmHero,
} from './apply-points-confirm';

function wrap(node: React.ReactNode): string {
  return renderToStaticMarkup(createElement(CopyProvider, { locale: 'en', children: node }));
}

function rowOf(html: string, name: string): string {
  const rows = html.split('<li ');
  return rows.find((row) => row.includes(name)) ?? '';
}

const RESPEC_HERO: ApplyPointsConfirmHero = { index: 0, hero: undefined, name: 'Bram', needsRespec: true, points: 12, gold: 500, skipReason: null };
const PLACE_HERO: ApplyPointsConfirmHero = { index: 1, hero: undefined, name: 'Orin', needsRespec: false, points: 4, gold: 0, skipReason: null };
const SKIPPED_HERO: ApplyPointsConfirmHero = { index: 2, hero: undefined, name: 'Vex', needsRespec: true, points: 9, gold: 300, skipReason: 'heroMissing' };
const UNTOUCHED_HERO: ApplyPointsConfirmHero = { index: null, hero: undefined, name: 'Kade', needsRespec: false, points: 0, gold: 0, skipReason: null };
const ALL = [RESPEC_HERO, PLACE_HERO, SKIPPED_HERO, UNTOUCHED_HERO];

describe('which heroes can be chosen', () => {
  it('a hero with a unit and no skip reason can be chosen; a skipped one and one the plan leaves alone cannot', () => {
    expect(isPointsConfirmHeroSelectable(RESPEC_HERO)).toBe(true);
    expect(isPointsConfirmHeroSelectable(PLACE_HERO)).toBe(true);
    expect(isPointsConfirmHeroSelectable(SKIPPED_HERO)).toBe(false);
    expect(isPointsConfirmHeroSelectable(UNTOUCHED_HERO)).toBe(false);
  });

  it('opens with every choosable hero chosen', () => {
    expect([...initialPointsSelection(ALL)].sort()).toEqual([0, 1]);
  });
});

describe('the gold the chosen respecs spend', () => {
  it('sums the respec heroes chosen and nothing else — a place-only hero is free, an unchosen respec is not spent', () => {
    expect(pointsSelectionGold(ALL, new Set([0, 1]))).toBe(500);
    expect(pointsSelectionGold(ALL, new Set([1]))).toBe(0);
    expect(pointsSelectionGold(ALL, new Set())).toBe(0);
  });

  it('never counts a skipped hero even if its index were chosen', () => {
    expect(pointsSelectionGold(ALL, new Set([2]))).toBe(300);
    expect(pointsSelectionGold(ALL, initialPointsSelection(ALL))).toBe(500);
  });
});

describe('the rows', () => {
  const html = wrap(createElement(ApplyPointsConfirmRows, { heroes: ALL, selected: new Set([0]), onToggle: () => {} }));

  it('lists every hero of the plan, one row each, the plan-untouched one included', () => {
    expect(html.match(/data-testid="apply-points-confirm-row"/g)).toHaveLength(4);
  });

  it('a respec row reads "respec" with the gold coin; a place-only row reads free; an untouched row says no respec is needed', () => {
    expect(rowOf(html, 'Bram')).toContain(en.applyConfirmPointsRespec);
    expect(rowOf(html, 'Bram')).toContain('icon_gold');
    expect(rowOf(html, 'Bram')).toContain('500');
    expect(rowOf(html, 'Orin')).toContain(en.applyLedgerFree);
    expect(rowOf(html, 'Kade')).toContain(en.applyConfirmPointsNoRespec);
    expect(rowOf(html, 'Vex')).toContain(en.applySkipHeroMissing);
  });

  it('only choosable rows carry an enabled switch, and the chosen one is checked', () => {
    expect(rowOf(html, 'Bram')).toContain('data-selectable="true"');
    expect(rowOf(html, 'Bram')).toContain('data-selected="true"');
    expect(rowOf(html, 'Orin')).toContain('data-selected="false"');
    expect(rowOf(html, 'Kade')).toContain('data-selectable="false"');
    expect(rowOf(html, 'Kade')).toMatch(/data-disabled/);
    expect(rowOf(html, 'Vex')).toContain('data-selectable="false"');
  });
});
