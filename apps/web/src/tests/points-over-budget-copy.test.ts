/**
 * The over-budget warning: when it fires, and what it says.
 *
 * `pointsExceedLevel` is the whole trigger — no saved sheet, no re-inference, no import-time
 * state — so this file pins both halves of it: the predicate's boundary, and that the copy
 * renders in both languages with nothing left unsubstituted.
 *
 * Why a warning exists at all: `inferSpentPoints` raises a `budgetMismatch` issue for exactly
 * this condition, but that issue lives on the import candidate and is dropped once the hero is
 * persisted. Every surface that shows the points afterwards had no way to know they did not add
 * up — the Points panel turned its counter red and said nothing, and the team plan's POINT RESET
 * table rendered an unclamped BEFORE against a clamped AFTER, so the reset appeared to destroy a
 * point.
 */
import { describe, expect, it } from 'vitest';
import { pointsExceedLevel, spentPointsOf } from '@bombfarm/domain/point-inference';
import { ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { STRINGS, sub, type Lang } from '@/shared/i18n';

const LANGS: Lang[] = ['en', 'pt'];

const alloc = (over: Partial<Record<SheetKey, number>>): Record<SheetKey, number> => ({
  ...ZERO_PTS(),
  ...over,
});

describe('pointsExceedLevel', () => {
  it('counts all eight keys, Luck included — the same accounting as `spentDelta`', () => {
    expect(spentPointsOf(alloc({ attack: 10, luck: 5 }))).toBe(15);
    expect(spentPointsOf(ZERO_PTS())).toBe(0);
  });

  it('fires only strictly above the level — a hero spent exactly out is not a warning', () => {
    // The reported shape: 67 + 24 + 6 + 1 = 98 on a level-97 hero, the last point phantom.
    const reported = alloc({ attack: 67, energy: 24, speed: 6, critDmg: 1 });
    expect(spentPointsOf(reported)).toBe(98);
    expect(pointsExceedLevel(reported, 97)).toBe(true);

    // The same hero once the skill tree's crit-damage node stopped being charged
    // percent-of-base — 97 on 97, exactly out, and silent.
    const fixed = alloc({ attack: 67, energy: 24, speed: 6 });
    expect(spentPointsOf(fixed)).toBe(97);
    expect(pointsExceedLevel(fixed, 97)).toBe(false);

    // Under-spent (points still banked) is normal and must never warn.
    expect(pointsExceedLevel(alloc({ attack: 3 }), 97)).toBe(false);
    expect(pointsExceedLevel(ZERO_PTS(), 0)).toBe(false);
  });
});

describe('pointsOverBudgetWarning copy', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: substitutes both numbers and leaves no placeholder behind`, () => {
      const text = sub(t.pointsOverBudgetWarning, { spent: 98, level: 97 });
      expect(text).toContain('98');
      expect(text).toContain('97');
      expect(text).not.toContain('{spent}');
      expect(text).not.toContain('{level}');
    });

    it(`${lang}: tells the player what to do, and where to escalate if it survives that`, () => {
      // The copy is an instruction, not just a diagnosis — a warning the player cannot act on
      // is noise. Asserted on both halves so a future reword cannot quietly drop either.
      expect(t.pointsOverBudgetWarning).toMatch(/save/i);
      expect(t.pointsOverBudgetWarning).toMatch(/discord/i);
    });

    it(`${lang}: names no stat — the residual lands wherever the mis-attribution falls`, () => {
      // Naming one would send the player chasing the symptom. The crit-damage case was only the
      // most recent; Golpe Brutal's put it in the same key, and the next one need not.
      for (const stat of Object.values(t.statFull)) {
        expect(t.pointsOverBudgetWarning).not.toContain(stat);
      }
    });
  }
});
