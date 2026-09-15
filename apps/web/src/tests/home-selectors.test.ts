import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { shortAccountId } from '@/features/home/model/account-id';
import {
  selectAccountUsable,
  selectFirstVisit,
  selectHasGearPool,
  selectHasRoster,
  selectMissingFieldsToName,
} from '@/features/home/model/home-selectors';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

const hero = normalizeHero({
  id: 'a',
  name: 'a',
  sourceId: 'src-a',
  updatedAt: 1,
  rarity: 'Raro',
  level: 20,
  stars: 0,
  naked: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
  gearedOverride: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
  loadout: emptyLoadout(),
  pts: ZERO_PTS(),
});

const item: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

const state = () => usePlannerStore.getState();

describe('the front page’s gating predicates', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('an account is usable only with a phase, a max phase and no missing required field', () => {
    const fixtures = [
      { phase: 51, maxPhase: 137, missingRequiredFields: null },
      { phase: null, maxPhase: 137, missingRequiredFields: [] },
      { phase: 51, maxPhase: null, missingRequiredFields: [] },
      { phase: 51, maxPhase: 137, missingRequiredFields: ['maxPhase' as const] },
    ];

    const answers = fixtures.map((fixture) => {
      usePlannerStore.setState(fixture);
      return selectAccountUsable(state());
    });

    expect(answers).toEqual([true, false, false, false]);
  });

  it('a first visit is no roster and no import ever applied', () => {
    expect(state().missingRequiredFields).toBeNull();
    expect(state().phase).toBeNull();
    expect(selectFirstVisit(state())).toBe(true);

    state().applyAccountImport({ tree: null, houseIdx: null, houseLevel: null, phase: null });
    expect(state().missingRequiredFields).toEqual([]);
    expect(state().phase).toBeNull();
    expect(selectFirstVisit(state())).toBe(false);

    resetPlannerStoreForTests();
    state().hydrateRoster([hero], 'a');
    expect(selectFirstVisit(state())).toBe(false);
  });

  it('the fields to name are the missing ones, else the phase when it is unknown, else nothing', () => {
    usePlannerStore.setState({ phase: null, missingRequiredFields: ['houseIdx', 'maxPhase'] });
    expect(selectMissingFieldsToName(state())).toBe(state().missingRequiredFields);

    usePlannerStore.setState({ phase: null, missingRequiredFields: [] });
    const phaseOnly = selectMissingFieldsToName(state());
    expect(phaseOnly).toEqual(['phase']);
    expect(selectMissingFieldsToName(state())).toBe(phaseOnly);

    usePlannerStore.setState({ phase: 51, missingRequiredFields: null });
    const nothing = selectMissingFieldsToName(state());
    expect(nothing).toEqual([]);
    expect(selectMissingFieldsToName(state())).toBe(nothing);
  });

  it('the roster and gear-pool predicates read the store’s own arrays', () => {
    expect(selectHasRoster(state())).toBe(false);
    expect(selectHasGearPool(state())).toBe(false);

    state().hydrateRoster([hero], 'a');
    usePlannerStore.setState({ inventory: { version: 1, importedAt: 1, items: [item] } });

    expect(selectHasRoster(state())).toBe(true);
    expect(selectHasGearPool(state())).toBe(true);
  });
});

describe('the account-id shortener', () => {
  it('a ten-character id stays whole and a seventeen-character one keeps its ends', () => {
    expect(shortAccountId('1234567890')).toBe('1234567890');
    expect(shortAccountId('76561198012345678')).toBe('7656…5678');
  });

  it('an eleven-character id is shortened', () => {
    expect(shortAccountId('12345678901')).toBe('1234…8901');
  });
});
