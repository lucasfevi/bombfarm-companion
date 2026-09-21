import { describe, expect, it, vi } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { PointAlloc } from '@bombfarm/domain/gear/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { AssignmentState } from '@bombfarm/domain/team-plan/solver-assignment';
import type {
  EvaluateRosterInput,
  TeamPlanInput,
  HeroPlanContext,
  RosterEvaluation,
} from '@bombfarm/domain/team-plan/types';
import { buildWaterfall } from '@bombfarm/domain/team-plan/waterfall';

/**
 * Under `ignoreFieldCrowding` the player asked for every hero to end up geared, and the hint
 * promises every empty slot is filled when the bag holds something that fits. The gold objective
 * is flat over most gear changes (hits-to-kill is a ceiling), so a fill is routinely worth
 * exactly 0 to the objective. A mocked `evaluateRoster` pins the objective so the fill is
 * decided on the flag alone, never on a gain the real objective may or may not show.
 */
vi.mock('@bombfarm/domain/team-plan/evaluate', () => ({
  evaluateRoster: vi.fn((input: EvaluateRosterInput): RosterEvaluation => ({
    objective: 1000,
    regime: 'underSaturated',
    sumDuty: 0,
    slots: input.slots,
    perHero: {},
    auras: {} as RosterEvaluation['auras'],
    entryPulseMult: 1,
    dutyByHeroId: {},
  })),
}));

const AMULET_ID = 'clay-epic';

function pts(): PointAlloc {
  return { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };
}

function emptySlots(): Record<string, string | null> {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null]));
}

function freeAmulet(): InventoryItem {
  return {
    id: AMULET_ID,
    defId: 'clay_amuleto',
    rarityIdx: 3,
    level: 40,
    upgrade: 12,
    slot: 'amuleto',
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
  };
}

function planWith(ignoreFieldCrowding: boolean, forgeFloor: number) {
  const currentPts: Record<string, PointAlloc> = { hero1: pts() };
  const baselineAssignment: AssignmentState = {
    slots: { hero1: emptySlots() },
    pool: new Set([AMULET_ID]),
  };
  const contexts = [
    { heroId: 'hero1', name: 'Hero One', level: 90, scope: 'optimize', pts: currentPts.hero1 },
  ] as unknown as HeroPlanContext[];
  const gearInput = {
    heroes: [{ heroId: 'hero1', name: 'Hero One', level: 90, pts: currentPts.hero1 }],
    inventory: [freeAmulet()],
    account: { slots: 1, fieldSlots: 1 },
    scopeByHeroId: { hero1: 'optimize' },
    forgeFloor,
    ignoreFieldCrowding,
  } as unknown as TeamPlanInput;

  // The search proposed nothing: a zero-gain fill is never a move it accepts.
  return buildWaterfall({
    gearInput,
    contexts,
    currentAssignment: baselineAssignment,
    planAssignment: baselineAssignment,
    finalPtsByHeroId: currentPts,
    itemById: new Map([[AMULET_ID, freeAmulet()]]),
  });
}

describe('ignoreFieldCrowding fills an empty slot the search left alone', () => {
  it('equips the free piece even though the search proposed no move and the fill gains nothing', () => {
    const result = planWith(true, 0);

    expect(result.assignment.slots.hero1?.amuleto).toBe(AMULET_ID);
    expect(result.moveList).toEqual([expect.objectContaining({ itemId: AMULET_ID, toHeroId: 'hero1' })]);
  });

  it('still fills when a forge floor is set, so the forge-only arm does not win the tie', () => {
    const result = planWith(true, 12);

    expect(result.assignment.slots.hero1?.amuleto).toBe(AMULET_ID);
  });

  it('leaves the slot empty when the flag is off, so a zero-gain chore is never invented', () => {
    const result = planWith(false, 0);

    expect(result.assignment.slots.hero1?.amuleto).toBeNull();
    expect(result.moveList).toEqual([]);
  });
});
