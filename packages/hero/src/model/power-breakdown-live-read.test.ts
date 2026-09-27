/**
 * The Power panel's sheet against a real account read: every hero, as the Combat stage builds it.
 *
 * The stored `power` is the game's own figure without runes, so the sheet the panel scores —
 * the pipeline's `adjusted`, runes on — must land on it exactly once the runes come back off.
 * The zero-points `gearedOverride` a record also carries is the witness that the choice matters.
 */
import { describe, expect, it } from 'vitest';
import {
  GAME_POWER_CDR_CHECKED_MAX_PCT,
  gamePower,
  gamePowerInputOf,
  gamePowerInputWithoutRunes,
} from '@bombfarm/domain/game-power';
import { composeSheetFromBirth, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { hasRuneOnSheet, runesOf } from '@bombfarm/domain/runes';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { TEAM_AURA_SWITCH_IDS, type TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { factsForHero, loadBreakdownFixture, storedPowerAfterWideBlastNerf } from './combat-breakdown.test-fixture';

const fixture = loadBreakdownFixture('payload-20260913-20heroes-runes.json');
const treeCritDmgPct = fixture.account.tree.critDmg;
const everyAuraOn = Object.fromEntries(TEAM_AURA_SWITCH_IDS.map((id) => [id, true])) as TeamAuraSwitches;

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual / expected - 1);
}

function panelInput(hero: HeroRecord, switches?: TeamAuraSwitches) {
  return gamePowerInputOf(factsForHero(fixture, hero, switches).adjusted, hero.abilities);
}

function runeFreePower(hero: HeroRecord, switches?: TeamAuraSwitches): number {
  return gamePower(gamePowerInputWithoutRunes(panelInput(hero, switches), runesOf(hero), treeCritDmgPct));
}

function storedPower(hero: HeroRecord): number {
  return storedPowerAfterWideBlastNerf(hero);
}

describe('the Power panel on a live account read', () => {
  it('non-vacuity: twenty heroes, all with a stored power, six of them runed', () => {
    expect(fixture.heroes).toHaveLength(20);
    for (const hero of fixture.heroes) expect(hero.power, hero.name).toBeGreaterThan(0);
    expect(fixture.heroes.filter((hero) => hasRuneOnSheet(runesOf(hero)))).toHaveLength(6);
  });

  it.each(fixture.heroes.map((hero) => [hero.name, hero] as const))(
    '%s: the panel’s sheet, runes taken off, scores the stored power to 1e-12',
    (_name, hero) => {
      expect(relativeError(runeFreePower(hero), storedPower(hero))).toBeLessThan(1e-12);
    },
  );

  it('team auras do not reach the sheet: every aura switched on scores the same', () => {
    for (const hero of fixture.heroes) {
      expect(relativeError(runeFreePower(hero, everyAuraOn), storedPower(hero)), hero.name).toBeLessThan(1e-12);
    }
  });

  it('a runed hero’s total, runes on, is at least its rune-free figure', () => {
    for (const hero of fixture.heroes.filter((candidate) => hasRuneOnSheet(runesOf(candidate)))) {
      expect(gamePower(panelInput(hero)), hero.name).toBeGreaterThanOrEqual(storedPower(hero));
    }
  });

  it('the stored zero-points sheet is the wrong one: it misses the game figure on heroes with points spent', () => {
    const misses = fixture.heroes.filter((hero) => {
      const zeroPoints = gamePowerInputWithoutRunes(
        gamePowerInputOf(hero.gearedOverride, hero.abilities),
        runesOf(hero),
        treeCritDmgPct,
      );
      return relativeError(gamePower(zeroPoints), storedPower(hero)) > 1e-3;
    });
    expect(misses.length).toBeGreaterThan(10);
  });

  it('the highest rune-free cooldown this read checks is the bound the chart draws solid to', () => {
    const cooldowns = fixture.heroes.map(
      (hero) => gamePowerInputWithoutRunes(panelInput(hero), runesOf(hero), treeCritDmgPct).sheet.cdr,
    );
    expect(Math.max(...cooldowns)).toBeCloseTo(GAME_POWER_CDR_CHECKED_MAX_PCT, 2);
  });

  it.each([10, 50])(
    'a stat point is linear: +%d points on any axis, recomposed from birth, is adjusted + N × the pipeline delta',
    (added) => {
      const tree: TreeSheetTotals = {
        danoStatic: fixture.account.tree.danoTotal,
        energyPct: fixture.account.tree.energy,
        speedPct: fixture.account.tree.speed,
        critChancePct: fixture.account.tree.critChance,
        critDmgPct: fixture.account.tree.critDmg,
        luckFlatPct: fixture.account.tree.luckFlatPct ?? 0,
      };
      let checked = 0;
      for (const hero of fixture.heroes) {
        const facts = factsForHero(fixture, hero);
        if (!hero.birth) throw new Error(`${hero.name} has no birth roll`);
        for (const key of SHEET_KEYS) {
          const recomposed = composeSheetFromBirth({
            birth: hero.birth,
            level: hero.level,
            stars: hero.stars,
            sheetOther: facts.sheetOther,
            loadout: hero.loadout,
            pts: { ...hero.pts, [key]: hero.pts[key] + added },
            tree,
            runes: hero.runes,
          });
          const linear = facts.adjusted[key] + added * facts.delta[key];
          expect(Math.abs(recomposed[key] - linear), `${hero.name} ${key}`).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(linear)));
          for (const other of SHEET_KEYS) {
            if (other === key) continue;
            expect(recomposed[other], `${hero.name} ${key}→${other}`).toBeCloseTo(facts.adjusted[other], 9);
          }
          checked += 1;
        }
      }
      expect(checked).toBe(fixture.heroes.length * SHEET_KEYS.length);
    },
  );
});
