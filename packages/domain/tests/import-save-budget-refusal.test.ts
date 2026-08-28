/**
 * The importer must never hand out a spent-point vector larger than the hero's budget.
 *
 * The game grants exactly one point per level and `stat_points_available` is what is left
 * unspent, so `level - available` is not an estimate of the budget — it IS the budget, stated by
 * the game in the save. An inversion landing above it has charged an ability or gear contribution
 * to spent points; the hero did not over-spend, the sheet math did.
 *
 * WHY THIS BLOCKS RATHER THAN CLAMPS. Clamping would have to invent which stat loses the excess,
 * which is a second wrong answer wearing a legal shape, and `point-inference.ts`'s own contract
 * forbids a silent scale or a redistributed residual. Blocking is the same call the
 * missing-`stats` case makes two lines away, for the same reason: an invented allocation is worse
 * than no hero. It is not theoretical — the Respec Advisor budget escape fixed in PR #183 was an
 * over-recovered vector reaching a recommendation.
 *
 * ONLY THE OVER DIRECTION BLOCKS. Under-recovery is the cap-saturation case (`saturatedStats` on
 * `budgetMismatch`), which yields a build the game can actually grant, so it stays a warning.
 *
 * FIXTURE-INDEPENDENT BY CONSTRUCTION. Every capture that exhibits this is pre-2026-08-18 and is
 * being retired, so a test that read one would die with the corpus. The subject here is built:
 * a hero whose `stats.dmg` is inflated past anything its birth roll and level can explain, so the
 * attack inversion necessarily over-recovers.
 */
import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';

/** A single clean hero: level 5, nothing unspent, so the budget is exactly 5. */
function oneHeroSave(statsOverride: Record<string, number> = {}) {
  const birth = {
    dmg: 100,
    energia: 150,
    speed: 45,
    crit_chance: 0.05,
    crit_dmg: 1.5,
    penetration: 0.5,
    cooldown_reduction: 0.01,
    luck: 0.02,
  };
  return {
    export_version: 1,
    generated_at: '2026-08-25T00:00:00Z',
    heroes: [
      {
        id: '9001',
        name: 'Subject',
        level: 5,
        rarity: 1,
        stars: 0,
        battle_allowed: true,
        abilities: [],
        stat_points_available: 0,
        birth_stats: birth,
        stats: { ...birth, ...statsOverride },
      },
    ],
    items: [],
    // The positive discriminator requires these three paths present, or the whole file
    // is rejected before any hero is read. Values are irrelevant; presence is the whole test.
    skills: { refunds: {}, totals: { vagas_campo: 0, bag_tabs_bonus: 0 }, levels: {} },
    casa: { active_casa: 1, cycle_secs: 1000, levels: [1, 0, 0, 0, 0], slots: 1 },
  };
}

const spent = (pts: Record<string, number>) => SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);

describe('the importer refuses a spent-point vector larger than the budget', () => {
  it('the control: a hero whose sheet its budget explains imports unblocked', () => {
    // `stats` equal to `birth_stats` at level 5 is not exactly a zero-point sheet (the level
    // factor moves `dmg`), so this hero is allowed to carry inference issues. What it must NOT
    // do is over-recover, and it must import.
    const { candidates, rejected } = parseSaveFile(oneHeroSave(), []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(1);
    expect(spent(candidates[0].record.pts)).toBeLessThanOrEqual(5);
    expect(candidates[0].blocked).toBe(false);
  });

  it('a sheet no budget can explain blocks the hero instead of storing the vector', () => {
    // 100 -> 100,000 attack: the inversion has no legal allocation that reaches this, so it
    // recovers a spend far above the level-5 budget.
    const { candidates, rejected } = parseSaveFile(oneHeroSave({ dmg: 100_000 }), []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(1);
    const candidate = candidates[0];

    expect(candidate.blocked).toBe(true);
    // The vector is not merely flagged — it is not handed out at all.
    expect(spent(candidate.record.pts)).toBe(0);
    expect(
      candidate.issues.some((issue) => issue.includes('against a budget of 5')),
      `issues were: ${candidate.issues.join(' | ')}`,
    ).toBe(true);
  });

  it('the block is what stops it: without the refusal this hero would carry an illegal vector', () => {
    // The RED state, asserted rather than described. `inferSpentPoints` is what the importer
    // calls, and on this input it really does return a vector above the budget — so the guard
    // above is testing a live condition, not one that cannot arise. If the inversion ever stopped
    // over-recovering here, this fails and the guard above becomes vacuous.
    const { candidates } = parseSaveFile(oneHeroSave({ dmg: 100_000 }), []);
    const mismatch = candidates[0].pointIssues.find((issue) => issue.kind === 'budgetMismatch');
    expect(mismatch, `pointIssues: ${JSON.stringify(candidates[0].pointIssues)}`).toBeDefined();
    expect(mismatch!.kind === 'budgetMismatch' && mismatch!.difference).toBeGreaterThan(0);
    expect(mismatch!.kind === 'budgetMismatch' && mismatch!.budget).toBe(5);
  });

  it('under-recovery does NOT block — a smaller-than-budget spend is a build the game can grant', () => {
    // The opposite direction of the same mismatch. A hero that inverts to FEWER points than its
    // budget is storable: the allocation is reachable, just incomplete. Blocking it would take
    // out every cap-saturated hero, which is a documented normal state.
    const { candidates } = parseSaveFile(oneHeroSave({ dmg: 100 }), []);
    const candidate = candidates[0];
    expect(spent(candidate.record.pts)).toBeLessThan(5);
    expect(candidate.blocked).toBe(false);
  });
});
