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
import { heroCopyFor } from '../copy';
import { factsForHero, loadBreakdownFixture } from '../model/combat-breakdown.test-fixture';
import { formatPowerFigure, powerAxisSpec, powerReading, powerReadoutText, steppedGuide } from '../model/power-breakdown';
import { PowerBreakdownPanel } from './power-breakdown-panel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TREE_CRIT_DMG_PCT = 90.88461522;
const STORED_POWER = 28_031_028.0631238;

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
type Shown = { readonly hero: PanelHero; readonly sheet: SheetStats | null };
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

function render({ hero, sheet }: Shown, treeCritDmgPct: number = TREE_CRIT_DMG_PCT) {
  act(() => {
    root.render(
      <PowerBreakdownPanel hero={hero} sheet={sheet} treeCritDmgPct={treeCritDmgPct} lang="en" statLabel={label} />,
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
    expect(query('[data-testid="power-total"]').textContent).toBe('32.41M');
    expect(query('[data-testid="power-rune-note"]').textContent).toBe('Includes active runes · 28.03M without them');
  });

  it('says nothing about runes for a hero carrying none, and its total is the stored figure', () => {
    render(PLAIN);
    expect(query('[data-testid="power-total"]').textContent).toBe('28.03M');
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
    expect(rows[0].textContent).toBe('Crit (chance × damage)×8.8046.8%');
    expect(rows.at(-1)?.textContent).toContain('anchor');
    expect(container.querySelectorAll('[data-power-segment]')).toHaveLength(7);
  });

  it.each(['en', 'pt'] as const)('%s: a header names the columns, and each number column explains itself by keyboard', (lang) => {
    const copy = heroCopyFor(lang);
    act(() => {
      root.render(
        <PowerBreakdownPanel hero={RUNED.hero} sheet={RUNED.sheet} treeCritDmgPct={TREE_CRIT_DMG_PCT} lang={lang} statLabel={label} />,
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
    expect(Math.abs(total / 32_411_057.17 - 1)).toBeLessThan(1e-6);
  });

  it('a hero with no Wide Blast keeps its "now" label inside the plot, clear of the axis labels', () => {
    render({ ...PLAIN, hero: { ...PLAIN.hero, abilities: {} } });
    click('[data-power-row="range"]');
    const nowLabel = query('[data-power-chart="explosaoAmpla"] [data-testid="power-now-label"]');
    expect(nowLabel.dataset.anchor).toBe('start');
    expect(nowLabel.style.left).toBe('0%');
    expect(query('[data-power-chart="explosaoAmpla"] [data-testid="power-y-max"]').closest('[role="slider"]')).toBeNull();
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

  it('a hero whose points were only estimated says by how much its figure differs from the game', () => {
    render({ ...PLAIN, hero: { ...PLAIN.hero, power: STORED_POWER / 1.0033 } });
    expect(query('[data-testid="power-mismatch-note"]').textContent).toBe(
      "Differs from the game's figure by +0.33% (points estimated)",
    );
    expect(container.querySelectorAll('[data-power-row]')).toHaveLength(8);
    render({ ...PLAIN, hero: { ...PLAIN.hero, power: STORED_POWER * 1.0105 } });
    expect(query('[data-testid="power-mismatch-note"]').textContent).toBe(
      "Differs from the game's figure by −1.04% (points estimated)",
    );
  });

  it('with no stored figure there is nothing to compare against', () => {
    render({ ...PLAIN, hero: { ...PLAIN.hero, power: undefined } });
    expect(container.querySelector('[data-testid="power-mismatch-note"]')).toBeNull();
  });

  it('a hero whose points were not recovered gets the stored figure and the reason, and no breakdown', () => {
    render({ hero: RUNED.hero, sheet: null });
    expect(query('[data-testid="power-total"]').textContent).toBe('28.03M');
    expect(query('[data-testid="power-withheld"]').textContent).toBe(t.heroDetailPowerWithheld);
    expect(container.querySelector('[data-power-row]')).toBeNull();
    expect(container.querySelector('[data-power-segment]')).toBeNull();
  });
});

describe('PowerBreakdownPanel on a live account read', () => {
  const fixture = loadBreakdownFixture('payload-20260913-20heroes-runes.json');
  const shownFor = (hero: HeroRecord): Shown => ({ hero, sheet: factsForHero(fixture, hero).adjusted });

  it.each(fixture.heroes.map((hero) => [hero.name, hero] as const))(
    '%s: the total is the Combat stage’s sheet scored, and runes never lower it',
    (_name, hero) => {
      render(shownFor(hero), fixture.account.tree.critDmg);
      const total = gamePower(gamePowerInputOf(factsForHero(fixture, hero).adjusted, hero.abilities));
      expect(query('[data-testid="power-total"]').textContent).toBe(formatPowerFigure(total));
      expect(total).toBeGreaterThanOrEqual((hero.power ?? 0) * (1 - 1e-12));
      expect(container.querySelector('[data-testid="power-mismatch-note"]')).toBeNull();
      const note = container.querySelector('[data-testid="power-rune-note"]');
      if (hasRuneOnSheet(runesOf(hero))) {
        expect(note?.textContent).toBe(`Includes active runes · ${formatPowerFigure(hero.power ?? 0)} without them`);
      } else {
        expect(note).toBeNull();
      }
    },
  );
});
