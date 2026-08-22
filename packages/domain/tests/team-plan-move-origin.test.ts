import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import type { ScopeState } from '@bombfarm/domain/team-plan/types';
import { teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

/** Every other hero donates, so the plan can source gear off a hero it does not optimize. */
function planWithAlternatingDonors(file: string) {
  const input = teamPlanInputFromFixture(file);
  const donors = new Set(input.heroes.filter((_, index) => index % 2 === 1).map((h) => h.heroId));
  input.scopeByHeroId = Object.fromEntries(
    input.heroes.map((hero): [string, ScopeState] => [
      hero.heroId,
      donors.has(hero.heroId) ? 'donate' : 'optimize',
    ]),
  );
  const result = runTeamPlan(input);
  if (result.blocked) throw new Error('plan blocked');
  return { input, donors, plan: result.plan };
}

describe('move list origins', () => {
  it('reports the donor hero, not the inventory, as the source of a worn item', () => {
    const { input, donors, plan } = planWithAlternatingDonors('payload-20260812-8heroes.json');
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));

    const fromDonor = plan.moveList.filter(
      (move) => move.phase === 'equip' && donors.has(itemById.get(move.itemId)?.equippedBy ?? ''),
    );
    expect(fromDonor.length).toBeGreaterThan(0);
    for (const move of fromDonor) {
      expect(move.fromHeroId).toBe(itemById.get(move.itemId)?.equippedBy);
    }
  });

  it('pairs every donor-sourced equip with an unequip off its current wearer', () => {
    const { input, donors, plan } = planWithAlternatingDonors('payload-20260812-8heroes.json');
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const unequipByItemId = new Map(
      plan.moveList.filter((move) => move.phase === 'unequip').map((move) => [move.itemId, move]),
    );

    for (const move of plan.moveList) {
      if (move.phase !== 'equip') continue;
      const owner = itemById.get(move.itemId)?.equippedBy;
      if (!owner || !donors.has(owner)) continue;
      expect(unequipByItemId.get(move.itemId)?.fromHeroId).toBe(owner);
    }
  });

  it('never claims an equipped item comes from the inventory', () => {
    for (const file of ['payload-20260812-8heroes.json', 'save-20260813-5heroes.json']) {
      const { input, plan } = planWithAlternatingDonors(file);
      const itemById = new Map(input.inventory.map((item) => [item.id, item]));
      for (const move of plan.moveList) {
        const owner = itemById.get(move.itemId)?.equippedBy;
        if (!owner) continue;
        expect(move.fromHeroId).toBe(owner);
      }
    }
  });

  it('leaves a donor item that the plan does not take where it is', () => {
    const { input, donors, plan } = planWithAlternatingDonors('payload-20260812-8heroes.json');
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const moved = new Set(plan.moveList.map((move) => move.itemId));
    const untouchedDonorItems = input.inventory.filter(
      (item) => donors.has(item.equippedBy ?? '') && !moved.has(item.id),
    );
    expect(untouchedDonorItems.length).toBeGreaterThan(0);
  });
});
