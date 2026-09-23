import { describe, expect, it } from 'vitest';
import {
  GAME_POWER_AXES,
  gamePower,
  gamePowerAxisValue,
  gamePowerCurve,
  gamePowerShares,
  withGamePowerAxis,
  type GamePowerInput,
} from '@bombfarm/domain/game-power';
import { saveSheetUnits } from '@bombfarm/domain/save-units';
import { heroCopyFor } from '../copy';
import {
  POWER_ROW_AXES,
  POWER_ROW_IDS,
  axisValueAtFraction,
  formatAxisValue,
  formatPowerFigure,
  markLabelAnchor,
  powerAxisSpec,
  powerChartSeries,
  powerFactorRows,
  powerReading,
  powerReadoutText,
  steppedGuide,
} from './power-breakdown';

const INPUT: GamePowerInput = {
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

describe('powerFactorRows', () => {
  it('lists the seven factors in display order, then attack as the anchor with no multiplier or share', () => {
    const rows = powerFactorRows(INPUT);
    expect(rows.map((row) => row.id)).toEqual(['crit', 'speed', 'range', 'utility', 'energy', 'penetration', 'cooldown', 'attack']);
    expect(rows.at(-1)).toEqual({ id: 'attack', multiplier: null, share: null });
    const total = rows.reduce((sum, row) => sum + (row.share ?? 0), 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it('a factor below its neutral value shows a zero share, never a negative one', () => {
    const belowNeutral = withGamePowerAxis(INPUT, 'penetration', -80);
    expect(gamePowerShares(belowNeutral).penetration).toBeLessThan(0);
    const rows = powerFactorRows(belowNeutral);
    expect(rows.find((row) => row.id === 'penetration')?.share).toBe(0);
    for (const row of rows) if (row.share !== null) expect(row.share, row.id).toBeGreaterThanOrEqual(0);
  });

  it('every row opens at least one chart, and crit opens chance and damage', () => {
    for (const id of POWER_ROW_IDS) expect(POWER_ROW_AXES[id].length).toBeGreaterThan(0);
    expect(POWER_ROW_AXES.crit).toEqual(['critChance', 'critDmg']);
  });
});

describe('powerAxisSpec', () => {
  it.each([
    ['critChance', 0, 100, 100],
    ['critDmg', 0, 2000, null],
    ['speed', 0, 200, null],
    ['energy', 0, 12_000, null],
    ['penetration', 0, 150, null],
    ['cdr', 0, 80, 80],
    ['luck', 0, 300, null],
    ['explosaoAmpla', 0, 20, null],
  ] as const)('%s runs %d to %d with cap %s', (axis, lo, hi, cap) => {
    const spec = powerAxisSpec(INPUT, axis);
    expect([spec.lo, spec.hi, spec.cap]).toEqual([lo, hi, cap]);
  });

  it('attack runs to 2.2 times the hero’s own attack', () => {
    expect(powerAxisSpec(INPUT, 'attack').hi).toBeCloseTo(2.2 * INPUT.sheet.attack, 6);
  });

  it('only cooldown carries a checked bound, at 17.85%', () => {
    for (const axis of GAME_POWER_AXES) {
      expect(powerAxisSpec(INPUT, axis).checkedMax, axis).toBe(axis === 'cdr' ? 17.85 : null);
    }
  });

  it.each([
    ['critChance', 130],
    ['cdr', 92],
    ['speed', 260],
    ['penetration', -4],
  ] as const)('%s at %d: the axis stretches to reach the hero, so the guide never reads off the chart', (axis, value) => {
    const spec = powerAxisSpec(withGamePowerAxis(INPUT, axis, value), axis);
    expect(spec.lo).toBeLessThanOrEqual(value);
    expect(spec.hi).toBeGreaterThanOrEqual(value);
  });
});

describe('powerChartSeries', () => {
  it('every point is the formula itself at that value', () => {
    for (const axis of GAME_POWER_AXES) {
      const series = powerChartSeries(INPUT, powerAxisSpec(INPUT, axis));
      for (const point of [...series.solid, ...series.extrapolated]) {
        expect(point.power, `${axis} at ${String(point.x)}`).toBe(gamePower(withGamePowerAxis(INPUT, axis, point.x)));
      }
    }
  });

  it('cooldown is checked up to 17.85% and extrapolated from there to the 80% cap', () => {
    const series = powerChartSeries(INPUT, powerAxisSpec(INPUT, 'cdr'));
    expect(series.solid[0].x).toBe(0);
    expect(series.solid.at(-1)?.x).toBe(17.85);
    expect(series.extrapolated[0].x).toBe(17.85);
    expect(series.extrapolated.at(-1)?.x).toBe(80);
  });

  it('Explosão Ampla is plotted at whole levels only', () => {
    const series = powerChartSeries(INPUT, powerAxisSpec(INPUT, 'explosaoAmpla'));
    expect(series.solid.map((point) => point.x)).toEqual(Array.from({ length: 21 }, (_, level) => level));
  });

  it('crit damage carries the capped-chance line, which is the curve at 100% crit chance', () => {
    const series = powerChartSeries(INPUT, powerAxisSpec(INPUT, 'critDmg'));
    expect(series.cappedCrit.length).toBeGreaterThan(0);
    for (const point of series.cappedCrit) {
      expect(point.power).toBe(gamePower(withGamePowerAxis(withGamePowerAxis(INPUT, 'critDmg', point.x), 'critChance', 100)));
    }
    expect(powerChartSeries(INPUT, powerAxisSpec(INPUT, 'speed')).cappedCrit).toEqual([]);
  });

  it('the y axis clears the tallest line and the hero’s own Power', () => {
    const series = powerChartSeries(INPUT, powerAxisSpec(INPUT, 'critDmg'));
    const tallest = Math.max(...series.cappedCrit.map((point) => point.power));
    expect(series.yMax).toBeGreaterThan(tallest);
    expect(series.yMax).toBeGreaterThan(gamePower(INPUT));
  });
});

describe('powerReading', () => {
  it.each(GAME_POWER_AXES.map((axis) => [axis] as const))('%s: at the hero’s own value the change is zero', (axis) => {
    const reading = powerReading(INPUT, powerAxisSpec(INPUT, axis), gamePowerAxisValue(INPUT, axis));
    expect(reading.power / gamePower(INPUT)).toBeCloseTo(1, 12);
    expect(reading.deltaPct).toBeCloseTo(0, 9);
  });

  it('reads the same point the curve draws', () => {
    const spec = powerAxisSpec(INPUT, 'speed');
    const [point] = gamePowerCurve(INPUT, 'speed', 150, 150, 1);
    const reading = powerReading(INPUT, spec, 150);
    expect(reading.power).toBe(point.power);
    expect(reading.delta).toBe(point.power - gamePower(INPUT));
  });

  it('says a cooldown past 17.85% is extrapolated, and one at it is not', () => {
    const spec = powerAxisSpec(INPUT, 'cdr');
    expect(powerReading(INPUT, spec, 17.85).extrapolated).toBe(false);
    expect(powerReading(INPUT, spec, 17.9).extrapolated).toBe(true);
  });

  it('crit damage also reads Power at capped crit chance', () => {
    const reading = powerReading(INPUT, powerAxisSpec(INPUT, 'critDmg'), 1000);
    expect(reading.cappedCritPower).toBe(
      gamePower(withGamePowerAxis(withGamePowerAxis(INPUT, 'critDmg', 1000), 'critChance', 100)),
    );
    expect(powerReading(INPUT, powerAxisSpec(INPUT, 'luck'), 50).cappedCritPower).toBeNull();
  });
});

describe('the guide', () => {
  it('an arrow moves a hundredth of the axis, a page key ten of those, Home and End to the ends', () => {
    const spec = powerAxisSpec(INPUT, 'speed');
    expect(steppedGuide(spec, 100, 'ArrowRight')).toBe(102);
    expect(steppedGuide(spec, 100, 'ArrowDown')).toBe(98);
    expect(steppedGuide(spec, 100, 'PageUp')).toBe(120);
    expect(steppedGuide(spec, 199, 'PageUp')).toBe(200);
    expect(steppedGuide(spec, 100, 'Home')).toBe(0);
    expect(steppedGuide(spec, 100, 'End')).toBe(200);
  });

  it('Explosão Ampla steps and snaps to whole levels', () => {
    const spec = powerAxisSpec(INPUT, 'explosaoAmpla');
    expect(steppedGuide(spec, 14, 'ArrowRight')).toBe(15);
    expect(axisValueAtFraction(spec, 0.73)).toBe(15);
    expect(axisValueAtFraction(spec, 1.4)).toBe(20);
  });
});

describe('markLabelAnchor', () => {
  it('hangs a label inward near either edge, centred elsewhere', () => {
    expect(markLabelAnchor(0)).toBe('start');
    expect(markLabelAnchor(0.05)).toBe('start');
    expect(markLabelAnchor(0.5)).toBe('center');
    expect(markLabelAnchor(0.95)).toBe('end');
    expect(markLabelAnchor(1)).toBe('end');
  });
});

describe('formatting', () => {
  it('writes the total in two decimals, so it reads against the game’s abbreviated figure', () => {
    expect(formatPowerFigure(32_411_057.17, 'en')).toBe('32.41m');
    expect(formatPowerFigure(32_411_057.17, 'pt')).toBe('32,41m');
  });

  it('writes each axis in its own unit', () => {
    expect(formatAxisValue('critChance', 45, 'en')).toBe('45.0%');
    expect(formatAxisValue('critDmg', 975.11, 'en')).toBe('+975%');
    expect(formatAxisValue('explosaoAmpla', 15, 'en')).toBe('15');
    expect(formatAxisValue('energy', 10_819.5, 'en')).toBe('10,820');
  });

  it('the readout names the value, the Power there and the change from now', () => {
    const t = heroCopyFor('en');
    const spec = powerAxisSpec(INPUT, 'cdr');
    const text = powerReadoutText(powerReading(INPUT, spec, 0), 'Cooldown', spec, 'en', t);
    expect(text).toMatch(/^Cooldown 0\.0% → Power [\d.]+m \(−[\d.]+m, −[\d.]+% from now\)$/);
  });
});
