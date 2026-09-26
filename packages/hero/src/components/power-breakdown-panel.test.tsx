// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { statLabel } from '@bombfarm/domain/game-labels';
import type { SheetStats } from '@bombfarm/domain/gear';
import { gamePower, gamePowerInputOf, gamePowerInputWithRunes, type GamePowerInput } from '@bombfarm/domain/game-power';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { hasRuneOnSheet, runesOf, type HeroRune } from '@bombfarm/domain/runes';
import { saveSheetUnits } from '@bombfarm/domain/save-units';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { heroCopyFor, type Lang } from '../copy';
import {
  factsForHero,
  fixtureHero,
  loadBreakdownFixture,
  storedPowerAfterWideBlastNerf,
} from '../model/combat-breakdown.test-fixture';
import type { PointDelta } from '../model/power-breakdown';
import { formatPowerFigure, powerAxisSpec, powerReading, powerReadoutText, steppedGuide } from '../model/power-breakdown';
import { PowerBreakdownPanel } from './power-breakdown-panel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TREE_CRIT_DMG_PCT = 90.88461522;
const STORED_POWER = storedPowerAfterWideBlastNerf({
  name: 'rune witness',
  power: 28_031_028.0631238,
  abilities: { explosao_ampla: 20 },
});

const RUNE_FREE: GamePowerInput = {
  sheet: saveSheetUnits({
    dmg: 112044.45492238,
    energia: 10819.5114519185,
    speed: 84.5299927268602,
    luck: 1.07502543417208,
    crit_chance: 0.678503105935927,
    crit_dmg: 10.751104688216,
    penetration: 25.3147485698556,
    cooldown_reduction: 0.0773451554004449,
  }),
  explosaoAmplaLevel: 20,
};

function rune(axis: HeroRune['axis'], strengthPct: number): HeroRune {
  return { axis, strengthPct, playSecondsLeft: 3600, rarity: 0 };
}

const RUNES: readonly HeroRune[] = [rune('crit', 9), rune('critdmg', 9), rune('energy', 5), rune('xp', 9)];

type PanelHero = Pick<HeroRecord, 'abilities' | 'runes' | 'power'>;
type Shown = { readonly hero: PanelHero; readonly sheet: SheetStats | null; readonly pointDelta?: PointDelta | null };
type Scored = Shown & { readonly sheet: SheetStats };

/**
 * The Combat stage hands the panel the pipeline's `adjusted` sheet — composed with points and the
 * hero's runes, before any team aura — and the record's stored Power, which the game keeps
 * without runes. These two stand in for that pair on the rune witness; the live-read tests below
 * build it through the real account path.
 */
const RUNED: Scored = {
  hero: { abilities: { explosao_ampla: 20 }, runes: RUNES, power: STORED_POWER },
  sheet: gamePowerInputWithRunes(RUNE_FREE, RUNES, TREE_CRIT_DMG_PCT).sheet,
};

const PLAIN: Scored = {
  hero: { abilities: { explosao_ampla: 20 }, runes: [], power: STORED_POWER },
  sheet: RUNE_FREE.sheet,
};

const label = (key: SheetKey) => (key === 'luck' ? 'Luck' : statLabel(key, 'en'));
const t = heroCopyFor('en');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render({ hero, sheet, pointDelta = null }: Shown, treeCritDmgPct: number = TREE_CRIT_DMG_PCT, lang: Lang = 'en') {
  act(() => {
    root.render(
      <PowerBreakdownPanel
        hero={hero}
        sheet={sheet}
        pointDelta={pointDelta}
        treeCritDmgPct={treeCritDmgPct}
        lang={lang}
        statLabel={lang === 'en' ? label : (key: SheetKey) => (key === 'luck' ? 'Sorte' : statLabel(key, 'pt'))}
      />,
    );
  });
}

function query(selector: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`nothing matches ${selector}`);
  return element;
}

function click(selector: string) {
  act(() => {
    query(selector).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function press(element: HTMLElement, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('PowerBreakdownPanel', () => {
  it('prints the rune-inclusive total the game shows, and names the stored rune-free figure beside it', () => {
    render(RUNED);
    expect(query('[data-testid="power-total"]').textContent).toBe('25.93M');
    expect(query('[data-testid="power-rune-note"]').textContent).toBe('Includes active runes · 22.42M without them');
  });

  it('says nothing about runes for a hero carrying none, and its total is the stored figure', () => {
    render(PLAIN);
    expect(query('[data-testid="power-total"]').textContent).toBe('22.42M');
    expect(container.querySelector('[data-testid="power-rune-note"]')).toBeNull();
  });

  it('lists every factor with its multiplier and share, attack last as the anchor', () => {
    render(RUNED);
    const rows = [...container.querySelectorAll<HTMLButtonElement>('[data-power-row]')];
    expect(rows.map((row) => row.dataset.powerRow)).toEqual([
      'crit',
      'speed',
      'range',
      'luck',
      'energy',
      'penetration',
      'cooldown',
      'attack',
    ]);
    expect(rows[0]!.textContent).toBe('Crit (chance × damage)×8.8049.1%');
    expect(rows.at(-1)?.textContent).toContain('anchor');
    expect(container.querySelectorAll('[data-power-segment]')).toHaveLength(7);
  });

  it.each(['en', 'pt'] as const)('%s: a header names the columns, and each number column explains itself by keyboard', (lang) => {
    const copy = heroCopyFor(lang);
    act(() => {
      root.render(
        <PowerBreakdownPanel
          hero={RUNED.hero}
          sheet={RUNED.sheet}
          pointDelta={null}
          treeCritDmgPct={TREE_CRIT_DMG_PCT}
          lang={lang}
          statLabel={label}
        />,
      );
    });
    const header = query('[data-testid="power-columns-header"]');
    expect(header.textContent).toBe(`${copy.heroDetailPowerColFactor}${copy.heroDetailPowerColMultiplier}${copy.heroDetailPowerColShare}`);
    for (const [name, tip] of [
      [copy.heroDetailPowerColMultiplier, copy.heroDetailPowerColMultiplierTip],
      [copy.heroDetailPowerColShare, copy.heroDetailPowerColShareTip],
    ]) {
      const trigger = [...header.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === `${name}: ${tip}`);
      expect(trigger, name).toBeDefined();
      expect(trigger?.tabIndex, name).toBe(0);
      expect(trigger?.hasAttribute('title')).toBe(false);
    }
  });

  it('opens no chart until a factor is picked', () => {
    render(RUNED);
    expect(container.querySelector('[data-power-chart]')).toBeNull();
    expect(query('[data-testid="power-chart-region"]').textContent).toBe(t.heroDetailPowerPick);
  });

  it('picking crit highlights its row and segment and opens the chance and damage charts; picking it again closes them', () => {
    render(RUNED);
    click('[data-power-row="crit"]');
    expect(query('[data-power-row="crit"]').getAttribute('aria-pressed')).toBe('true');
    expect(query('[data-power-segment="crit"]').dataset.selected).toBe('true');
    const charts = [...container.querySelectorAll<HTMLElement>('[data-power-chart]')].map((chart) => chart.dataset.powerChart);
    expect(charts).toEqual(['critChance', 'critDmg']);
    expect(query('[data-power-chart="critDmg"] [data-series="capped-crit"]')).toBeTruthy();
    expect(query('[data-power-chart="critDmg"] [data-testid="power-readout-capped"]').textContent).toMatch(
      /^At 100% crit chance: [\d.]+M$/,
    );

    click('[data-power-row="crit"]');
    expect(container.querySelector('[data-power-chart]')).toBeNull();
  });

  it('a share-bar segment opens the same chart as its row', () => {
    render(RUNED);
    click('[data-power-segment="speed"]');
    expect(query('[data-power-row="speed"]').getAttribute('aria-pressed')).toBe('true');
    expect(query('[data-power-chart]').dataset.powerChart).toBe('speed');
  });

  it('the arrow keys step the guide, and the readout follows it through the formula', () => {
    render(RUNED);
    click('[data-power-row="speed"]');
    const slider = query('[data-power-chart="speed"] [role="slider"]');
    const readout = () => query('[data-power-chart="speed"] [data-testid="power-readout"]').textContent;

    const input = gamePowerInputOf(RUNED.sheet, RUNED.hero.abilities);
    const spec = powerAxisSpec(input, 'speed');
    expect(readout()).toBe(powerReadoutText(powerReading(input, spec, input.sheet.speed), 'Speed', spec, 'en', t));
    expect(container.querySelector('[data-testid="power-guide-point"]')).toBeNull();

    press(slider, 'ArrowRight');
    const stepped = steppedGuide(spec, input.sheet.speed, 'ArrowRight');
    expect(readout()).toBe(powerReadoutText(powerReading(input, spec, stepped), 'Speed', spec, 'en', t));
    expect(readout()).toMatch(/\(\+[\d.]+k, \+[\d.]+% from now\)$/);
    expect(slider.getAttribute('aria-valuenow')).toBe(String(stepped));
    expect(container.querySelector('[data-testid="power-guide-point"]')).toBeTruthy();

    press(slider, 'Home');
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
    expect(readout()).toMatch(/^Speed 0\.0 → Power /);
  });

  it('a chart draws a Y axis with gridlines and labels Power and the stat at round ticks along both axes', () => {
    render(RUNED);
    click('[data-power-row="crit"]');
    const chart = query('[data-power-chart="critChance"]');
    expect(chart.querySelector('[data-testid="power-y-axis"]')).toBeTruthy();
    const xTicks = [...chart.querySelectorAll<HTMLElement>('[data-testid="power-x-ticks"] [data-tick]')].map((tick) => tick.textContent);
    expect(xTicks).toEqual(['0%', '25%', '50%', '75%', '100%']);
    const yTicks = [...chart.querySelectorAll<HTMLElement>('[data-testid="power-y-ticks"] [data-tick]')];
    expect(yTicks.length).toBeGreaterThanOrEqual(3);
    expect(yTicks[0]!.textContent).toBe('0');
    expect(chart.querySelectorAll('[data-gridline]')).toHaveLength(yTicks.length);
    expect(chart.querySelector('[data-testid="power-x-ticks"]')?.closest('[role="slider"]')).toBeNull();
    expect(query('[data-power-chart="critDmg"] [data-series="capped-crit"]')).toBeTruthy();
  });

  it('a cooldown past 17.85% says it is extrapolated', () => {
    render(RUNED);
    click('[data-power-row="cooldown"]');
    expect(container.querySelector('[data-testid="power-readout-extrapolated"]')).toBeNull();
    expect(query('[data-power-chart="cdr"] [data-series="extrapolated"]')).toBeTruthy();
    press(query('[data-power-chart="cdr"] [role="slider"]'), 'End');
    expect(query('[data-testid="power-readout-extrapolated"]').textContent).toBe(
      'Past the highest cooldown checked (17.85%), this is extrapolated.',
    );
  });

  it('the range chart steps whole Wide Blast levels', () => {
    render(RUNED);
    click('[data-power-row="range"]');
    const slider = query('[data-power-chart="explosaoAmpla"] [role="slider"]');
    press(slider, 'ArrowLeft');
    expect(slider.getAttribute('aria-valuenow')).toBe('19');
    expect(query('[data-power-chart="explosaoAmpla"] [data-testid="power-readout"]').textContent).toMatch(
      /^Wide Blast level 19 → Power /,
    );
  });

  it('the total is the formula on the sheet it was handed', () => {
    render(RUNED);
    const total = gamePower(gamePowerInputOf(RUNED.sheet, RUNED.hero.abilities));
    expect(query('[data-testid="power-total"]').textContent).toBe(formatPowerFigure(total));
    expect(Math.abs(total / (32_411_057.17 * (2 / 2.5)) - 1)).toBeLessThan(1e-6);
  });

  it('a hero with no Wide Blast keeps its "now" label inside the plot, clear of the axis labels', () => {
    render({ ...PLAIN, hero: { ...PLAIN.hero, abilities: {} } });
    click('[data-power-row="range"]');
    const nowLabel = query('[data-power-chart="explosaoAmpla"] [data-testid="power-now-label"]');
    expect(nowLabel.dataset.anchor).toBe('start');
    expect(nowLabel.style.left).toBe('0%');
    expect(query('[data-power-chart="explosaoAmpla"] [data-testid="power-y-ticks"]').closest('[role="slider"]')).toBeNull();
    expect(nowLabel.closest('[role="slider"]')).toBeNull();
  });

  it('a hero at the top of the curve and the right edge keeps its "now" label off the plot, where the curve runs', () => {
    render(RUNED);
    click('[data-power-row="range"]');
    const chart = query('[data-power-chart="explosaoAmpla"]');
    const nowDot = chart.querySelector<HTMLElement>('[role="slider"] span.bg-muted');
    expect(nowDot?.style.left).toBe('100%');
    expect(Number.parseFloat(nowDot?.style.top ?? '100')).toBeLessThan(25);
    const nowLabel = query('[data-power-chart="explosaoAmpla"] [data-testid="power-now-label"]');
    expect(nowLabel.dataset.anchor).toBe('end');
    expect(nowLabel.closest('[role="slider"]')).toBeNull();
  });

  it('a hero whose figure matches the game carries no mismatch note', () => {
    render(PLAIN);
    expect(container.querySelector('[data-testid="power-mismatch-note"]')).toBeNull();
    render(RUNED);
    expect(container.querySelector('[data-testid="power-mismatch-note"]')).toBeNull();
  });

  it('a hero whose figure differs from the game says by how much, without guessing why', () => {
    render({ ...PLAIN, hero: { ...PLAIN.hero, power: STORED_POWER / 1.0033 } });
    expect(query('[data-testid="power-mismatch-note"]').textContent).toBe(
      "Differs from the game's figure by +0.33%",
    );
    expect(container.querySelectorAll('[data-power-row]')).toHaveLength(8);
    render({ ...PLAIN, hero: { ...PLAIN.hero, power: STORED_POWER * 1.0105 } });
    expect(query('[data-testid="power-mismatch-note"]').textContent).toBe(
      "Differs from the game's figure by −1.04%",
    );
  });

  it('with no stored figure there is nothing to compare against', () => {
    const { power: _stored, ...withoutStoredPower } = PLAIN.hero;
    render({ ...PLAIN, hero: withoutStoredPower });
    expect(container.querySelector('[data-testid="power-mismatch-note"]')).toBeNull();
  });

  it('a hero whose points were not recovered gets the stored figure and the reason, and no breakdown', () => {
    render({ hero: RUNED.hero, sheet: null });
    expect(query('[data-testid="power-total"]').textContent).toBe('22.42M');
    expect(query('[data-testid="power-withheld"]').textContent).toBe(t.heroDetailPowerWithheld);
    expect(container.querySelector('[data-power-row]')).toBeNull();
    expect(container.querySelector('[data-power-segment]')).toBeNull();
  });
});

describe('PowerBreakdownPanel on a live account read', () => {
  const fixture = loadBreakdownFixture('payload-20260913-20heroes-runes.json');
  const shownFor = (hero: HeroRecord): Shown => ({
    hero: { ...hero, power: storedPowerAfterWideBlastNerf(hero) },
    sheet: factsForHero(fixture, hero).adjusted,
  });

  it.each(fixture.heroes.map((hero) => [hero.name, hero] as const))(
    '%s: the total is the Combat stage’s sheet scored, and runes never lower it',
    (_name, hero) => {
      render(shownFor(hero), fixture.account.tree.critDmg);
      const total = gamePower(gamePowerInputOf(factsForHero(fixture, hero).adjusted, hero.abilities));
      expect(query('[data-testid="power-total"]').textContent).toBe(formatPowerFigure(total));
      const stored = storedPowerAfterWideBlastNerf(hero);
      expect(total).toBeGreaterThanOrEqual(stored * (1 - 1e-12));
      expect(container.querySelector('[data-testid="power-mismatch-note"]')).toBeNull();
      const note = container.querySelector('[data-testid="power-rune-note"]');
      if (hasRuneOnSheet(runesOf(hero))) {
        expect(note?.textContent).toBe(`Includes active runes · ${formatPowerFigure(stored)} without them`);
      } else {
        expect(note).toBeNull();
      }
    },
  );
});

describe('PowerBreakdownPanel: where +10 and +50 stat points would put the hero', () => {
  const fixture = loadBreakdownFixture('payload-20260913-20heroes-runes.json');
  const hero = fixtureHero(fixture, 'Bellatrix');
  const facts = factsForHero(fixture, hero);
  const live: Shown = { hero, sheet: facts.adjusted, pointDelta: facts.delta };

  function chart(axis: string): HTMLElement {
    return query(`[data-power-chart="${axis}"]`);
  }

  it.each(['en', 'pt'] as const)('%s: the speed chart draws both markers on the curve and a legend carrying their figures', (lang) => {
    render(live, fixture.account.tree.critDmg, lang);
    click('[data-power-row="speed"]');
    const markers = [...chart('speed').querySelectorAll<HTMLElement>('[data-testid="power-marker"]')];
    expect(markers.map((marker) => marker.dataset.points)).toEqual(['10', '50']);
    for (const marker of markers) expect(marker.className).toContain('border-gold');
    const legend = chart('speed').querySelector('[data-testid="power-points-legend"]')?.textContent ?? '';
    const pattern =
      lang === 'en'
        ? /^\+10 points: [\d.]+[kMB]? \(\+[\d.]+%\) · \+50 points: [\d.]+[kMB]? \(\+[\d.]+%\)$/
        : /^\+10 pontos: [\d.]+[kMB]? \(\+[\d,]+%\) · \+50 pontos: [\d.]+[kMB]? \(\+[\d,]+%\)$/;
    expect(legend).toMatch(pattern);
  });

  it('crit chance points go on the chance chart and crit damage points on the damage chart', () => {
    render(live, fixture.account.tree.critDmg);
    click('[data-power-row="crit"]');
    expect(chart('critChance').querySelectorAll('[data-testid="power-marker"]')).toHaveLength(2);
    expect(chart('critDmg').querySelectorAll('[data-testid="power-marker"]')).toHaveLength(2);
    const chanceMarker = chart('critChance').querySelector<HTMLElement>('[data-testid="power-marker"][data-points="10"]');
    const damageMarker = chart('critDmg').querySelector<HTMLElement>('[data-testid="power-marker"][data-points="10"]');
    expect(chanceMarker?.style.left).not.toBe(damageMarker?.style.left);
  });

  it('a low-rate stat labels both markers anyway, on rows below "now", and the legend still names both', () => {
    render(live, fixture.account.tree.critDmg);
    click('[data-power-row="crit"]');
    const strip = chart('critChance');
    const now = strip.querySelector<HTMLElement>('[data-testid="power-now-label"]');
    const ten = strip.querySelector<HTMLElement>('[data-testid="power-marker-label"][data-points="10"]');
    const fifty = strip.querySelector<HTMLElement>('[data-testid="power-marker-label"][data-points="50"]');
    expect(now?.dataset.row).toBe('0');
    expect(ten?.textContent).toBe('+10');
    expect(fifty?.textContent).toBe('+50');
    expect(Number(ten?.dataset.row)).toBeGreaterThanOrEqual(1);
    expect(Number(fifty?.dataset.row)).toBeGreaterThanOrEqual(Number(ten?.dataset.row));
    expect(strip.querySelectorAll('[data-testid="power-marker"]')).toHaveLength(2);
    expect(strip.querySelector('[data-testid="power-points-legend"]')?.textContent).toContain('+50 points');
  });

  it('Range takes no points, so it draws no markers and no legend', () => {
    render(live, fixture.account.tree.critDmg);
    click('[data-power-row="range"]');
    expect(chart('explosaoAmpla').querySelectorAll('[data-testid="power-marker"]')).toHaveLength(0);
    expect(chart('explosaoAmpla').querySelector('[data-testid="power-points-legend"]')).toBeNull();
  });

  it('a marker past the crit-chance cap sits at the cap, and the legend says so', () => {
    const steep: PointDelta = { ...facts.delta, critChance: 0.8 };
    render({ ...RUNED, pointDelta: steep });
    click('[data-power-row="crit"]');
    const fifty = chart('critChance').querySelector<HTMLElement>('[data-testid="power-marker"][data-points="50"]');
    expect(fifty?.dataset.atCap).toBe('true');
    expect(fifty?.style.left).toBe('100%');
    expect(chart('critChance').querySelector('[data-testid="power-points-legend"]')?.textContent).toMatch(
      /\+50 points: [\d.]+M \(\+[\d.]+%, at the cap\)$/,
    );
  });

  it('with no deltas there are no markers', () => {
    render(RUNED);
    click('[data-power-row="speed"]');
    expect(chart('speed').querySelectorAll('[data-testid="power-marker"]')).toHaveLength(0);
  });
});
