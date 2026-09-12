/**
 * The loadouts one roster evaluation is handed: the assignment's for the heroes the search gears,
 * the roster's own for the heroes it leaves alone. Without the second half a leave-alone carrier
 * would be priced naked for the duty its aura is weighted by, on both objectives.
 */
import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { squadLoadouts, type AssignmentState } from '@bombfarm/domain/team-plan/solver-assignment';
import type { HeroPlanContext, TeamPlanHeroInput } from '@bombfarm/domain/team-plan/types';

const ITEM: InventoryItem = {
  id: 'assigned-arma',
  defId: 'ember_arma',
  rarityIdx: 3,
  level: 10,
  upgrade: 12,
  slot: 'arma',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

const ROSTER_ARMA = { defId: 'roster_arma', rarityIdx: 1, level: 3, upgrade: 0, slot: 'arma' as const };

function context(heroId: string, scope: HeroPlanContext['scope']): HeroPlanContext {
  return { heroId, scope } as HeroPlanContext;
}

function hero(heroId: string): TeamPlanHeroInput {
  return { heroId, loadout: { arma: ROSTER_ARMA } } as unknown as TeamPlanHeroInput;
}

const assignment: AssignmentState = {
  slots: { opt: { ...Object.fromEntries(SLOTS.map((slot) => [slot, null])), arma: ITEM.id } },
  pool: new Set(),
};

describe('squadLoadouts', () => {
  const itemById = new Map([[ITEM.id, ITEM]]);
  const contexts = [context('opt', 'optimize'), context('left', 'leaveAlone'), context('gone', 'donate')];
  const heroes = [hero('opt'), hero('left'), hero('gone')];

  it('reads an optimize hero off the assignment, never off the roster', () => {
    const out = squadLoadouts(assignment, itemById, contexts, heroes);
    expect(out.opt?.arma?.defId).toBe('ember_arma');
  });

  it('reads a leave-alone hero off the roster as it stands', () => {
    const out = squadLoadouts(assignment, itemById, contexts, heroes);
    expect(out.left?.arma?.defId).toBe('roster_arma');
  });

  it('carries nothing for a donated hero — it does not field', () => {
    const out = squadLoadouts(assignment, itemById, contexts, heroes);
    expect('gone' in out).toBe(false);
  });
});
