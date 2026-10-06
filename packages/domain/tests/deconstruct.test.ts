import { describe, expect, it } from 'vitest';
import {
  DECONSTRUCT_BATCH_MAX,
  DECONSTRUCT_FILL_BELOW_RARITY,
  DECONSTRUCT_WARN_RARITY,
  deconstructBatchSummary,
  deconstructBlockReason,
  deconstructFillCandidates,
  deconstructRefusalReason,
} from '@bombfarm/domain/deconstruct';
import { buildInventoryView, mapInventoryViewItem, type InventoryViewItem } from '@bombfarm/domain/inventory-view';

function gear(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1001',
    def_id: 'glacier_calca',
    set: 'glacier',
    rarity: 1,
    category: 0,
    slot: 3,
    level: 10,
    stats: [],
    power: 100,
    sell_value: '100',
    essence_value: 30,
    forge_fails: 0,
    forge_chance: 1,
    pergaminho_custo: 300,
    sellable: true,
    upgrade: 0,
    tradable: true,
    market_state: 0,
    locked: false,
    equipped_on: null,
    equip_slot: null,
    in_stash: false,
    ...overrides,
  };
}

function viewItem(overrides: Record<string, unknown> = {}): InventoryViewItem {
  const mapped = mapInventoryViewItem(gear(overrides));
  if (!mapped) throw new Error('fixture row did not map');
  return mapped;
}

describe('the game client constants', () => {
  it('caps a batch at one hundred, warns from Epic and fills below Rare', () => {
    expect(DECONSTRUCT_BATCH_MAX).toBe(100);
    expect(DECONSTRUCT_WARN_RARITY).toBe(3);
    expect(DECONSTRUCT_FILL_BELOW_RARITY).toBe(2);
  });
});

describe('deconstructBlockReason', () => {
  it('lets a plain unequipped piece of gear through', () => {
    expect(deconstructBlockReason(viewItem())).toBeNull();
  });

  it('refuses an item the server prices at zero as not burnable', () => {
    expect(deconstructBlockReason(viewItem({ essence_value: 0 }))).toBe('not_burnable');
  });

  it('refuses a chest, which the server prices at zero', () => {
    const chest = viewItem({ def_id: 'chest_item_90', category: 1, essence_value: 0 });
    expect(deconstructBlockReason(chest)).toBe('not_burnable');
  });

  it('lets a non-gear item through when the server gives it a positive worth', () => {
    const stone = viewItem({ def_id: 'forja_pedra_incomum', category: 8, essence_value: 30, in_stash: true });
    expect(deconstructBlockReason(stone)).toBeNull();
  });

  it('falls back to "is it gear" when the row carries no worth at all', () => {
    const { essence_value: _gone, ...withoutWorth } = gear();
    const piece = mapInventoryViewItem(withoutWorth);
    const key = mapInventoryViewItem({ ...withoutWorth, def_id: 'map_key_incomum', category: 4 });
    expect(piece && deconstructBlockReason(piece)).toBeNull();
    expect(key && deconstructBlockReason(key)).toBe('not_burnable');
  });

  it('names a worn piece equipped', () => {
    expect(deconstructBlockReason(viewItem({ equipped_on: '555', equip_slot: 3 }))).toBe('equipped');
  });

  it('names a piece the player locked', () => {
    expect(deconstructBlockReason(viewItem({ locked: true }))).toBe('locked');
  });

  it('names a piece the market holds', () => {
    expect(deconstructBlockReason(viewItem({ market_state: 1 }))).toBe('market');
  });

  it('names a piece with a socketed gem, and ignores an empty socket list', () => {
    expect(deconstructBlockReason(viewItem({ jewels: [{ def_id: 'gem_ruby' }] }))).toBe('has_gems');
    expect(deconstructBlockReason(viewItem({ jewels: [] }))).toBeNull();
  });

  it('names a piece still inside its import cooldown, and ignores one that has run out', () => {
    expect(deconstructBlockReason(viewItem({ export_lock_secs: 3600 }))).toBe('import_cooldown');
    expect(deconstructBlockReason(viewItem({ export_lock_secs: 0 }))).toBeNull();
  });

  it('reports not burnable before any state reason, because a worthless item is never offered', () => {
    expect(deconstructBlockReason(viewItem({ essence_value: 0, equipped_on: '555', locked: true }))).toBe('not_burnable');
  });

  it('reports the first state reason in the client order when several apply', () => {
    expect(deconstructBlockReason(viewItem({ equipped_on: '555', locked: true, market_state: 1 }))).toBe('equipped');
    expect(deconstructBlockReason(viewItem({ locked: true, market_state: 1, export_lock_secs: 9 }))).toBe('locked');
    expect(deconstructBlockReason(viewItem({ market_state: 1, jewels: [{}], export_lock_secs: 9 }))).toBe('market');
    expect(deconstructBlockReason(viewItem({ jewels: [{}], export_lock_secs: 9 }))).toBe('has_gems');
  });

  describe('when the server states its own verdict', () => {
    it('lets a refusal outrank a piece the local rule would burn', () => {
      const refused = viewItem({ ritual: { desconstruir: false, desconstruir_reason: 'ITEM_LOCKED' } });
      expect(deconstructBlockReason(refused)).toBe('market');
    });

    it('lets a refusal outrank a local reason too', () => {
      const refused = viewItem({
        equipped_on: '555',
        ritual: { desconstruir: false, desconstruir_reason: 'ITEM_HAS_GEMS' },
      });
      expect(deconstructBlockReason(refused)).toBe('has_gems');
    });

    it('falls back to not burnable when its reason is not a code the client knows', () => {
      expect(deconstructBlockReason(viewItem({ ritual: { desconstruir: false, desconstruir_reason: 'because' } }))).toBe(
        'not_burnable',
      );
      expect(deconstructBlockReason(viewItem({ ritual: { desconstruir: false } }))).toBe('not_burnable');
      expect(
        deconstructBlockReason(viewItem({ ritual: { desconstruir: false, desconstruir_reason: 'BURN_BATCH_TOO_BIG' } })),
      ).toBe('not_burnable');
    });

    it('does not let a permissive verdict lift a local block', () => {
      const wornButAllowed = viewItem({ equipped_on: '555', ritual: { desconstruir: true } });
      expect(deconstructBlockReason(wornButAllowed)).toBe('equipped');
    });
  });
});

describe('deconstructRefusalReason', () => {
  it.each([
    ['ITEM_EQUIPPED', 'equipped'],
    ['ITEM_USER_LOCKED', 'locked'],
    ['ITEM_LOCKED', 'market'],
    ['ITEM_HAS_GEMS', 'has_gems'],
    ['ITEM_IMPORT_COOLDOWN', 'import_cooldown'],
    ['ITEM_NOT_BURNABLE', 'not_burnable'],
    ['BURN_BATCH_TOO_BIG', 'batch_too_big'],
    ['NO_SUCH_ITEM', 'missing_item'],
  ])('reads %s as %s', (code, reason) => {
    expect(deconstructRefusalReason(code)).toBe(reason);
  });

  it('answers null for a code the client has no handling for, including a prototype name', () => {
    expect(deconstructRefusalReason('SOMETHING_NEW')).toBeNull();
    expect(deconstructRefusalReason('')).toBeNull();
    expect(deconstructRefusalReason('constructor')).toBeNull();
  });
});

describe('deconstructBatchSummary', () => {
  it('is all zeros for an empty batch', () => {
    expect(deconstructBatchSummary([])).toEqual({ count: 0, essence: 0, forged: 0, rare: 0 });
  });

  it('adds up the essence the server priced each item at', () => {
    const batch = [viewItem({ id: '1', essence_value: 30 }), viewItem({ id: '2', essence_value: 90 })];
    expect(deconstructBatchSummary(batch)).toMatchObject({ count: 2, essence: 120 });
  });

  it('counts a row with no stated worth as nothing rather than as a hole in the total', () => {
    const { essence_value: _gone, ...withoutWorth } = gear({ id: '3' });
    const unpriced = mapInventoryViewItem(withoutWorth);
    expect(unpriced && deconstructBatchSummary([unpriced]).essence).toBe(0);
  });

  it('counts forged pieces by a forge level above zero', () => {
    const batch = [viewItem({ id: '1', upgrade: 0 }), viewItem({ id: '2', upgrade: 1 }), viewItem({ id: '3', upgrade: 12 })];
    expect(deconstructBatchSummary(batch).forged).toBe(2);
  });

  it('counts rare from Epic upward and not a Rare', () => {
    const batch = [
      viewItem({ id: '1', rarity: 2 }),
      viewItem({ id: '2', rarity: 3 }),
      viewItem({ id: '3', rarity: 4 }),
      viewItem({ id: '4', rarity: 5 }),
    ];
    expect(deconstructBatchSummary(batch).rare).toBe(3);
  });
});

describe('deconstructFillCandidates', () => {
  const pool = [
    viewItem({ id: '30', rarity: 1, level: 20 }),
    viewItem({ id: '31', rarity: 0, level: 30 }),
    viewItem({ id: '32', rarity: 0, level: 10 }),
    viewItem({ id: '33', rarity: 1, level: 10 }),
    viewItem({ id: '34', rarity: 2, level: 1 }),
    viewItem({ id: '35', rarity: 4, level: 1 }),
  ];

  it('orders by rarity, then level, lowest first', () => {
    expect(deconstructFillCandidates(pool, [], 100)).toEqual(['32', '31', '33', '30']);
  });

  it('never picks a piece at the fill threshold or above', () => {
    const picked = deconstructFillCandidates(pool, [], 100);
    expect(picked).not.toContain('34');
    expect(picked).not.toContain('35');
  });

  it('breaks a tie on rarity and level by the lower id, comparing ids as numbers', () => {
    const tied = [viewItem({ id: '100' }), viewItem({ id: '9' }), viewItem({ id: '20' })];
    expect(deconstructFillCandidates(tied, [], 100)).toEqual(['9', '20', '100']);
  });

  it('gives the same answer whatever order the items arrive in', () => {
    expect(deconstructFillCandidates([...pool].reverse(), [], 100)).toEqual(deconstructFillCandidates(pool, [], 100));
  });

  it('fills only the room left under the cap', () => {
    expect(deconstructFillCandidates(pool, ['900', '901'], 4)).toEqual(['32', '31']);
  });

  it('adds nothing when the selection already fills the cap', () => {
    expect(deconstructFillCandidates(pool, ['900', '901'], 2)).toEqual([]);
    expect(deconstructFillCandidates(pool, ['900', '901', '902'], 2)).toEqual([]);
  });

  it('skips what is already selected without spending room on it', () => {
    expect(deconstructFillCandidates(pool, ['32'], 3)).toEqual(['31', '33']);
  });

  it('accepts the selection as a set as well as a list', () => {
    expect(deconstructFillCandidates(pool, new Set(['32']), 3)).toEqual(['31', '33']);
  });

  it('skips every blocked piece', () => {
    const blocked = [
      viewItem({ id: '1', equipped_on: '555' }),
      viewItem({ id: '2', locked: true }),
      viewItem({ id: '3', market_state: 1 }),
      viewItem({ id: '4', jewels: [{}] }),
      viewItem({ id: '5', export_lock_secs: 60 }),
      viewItem({ id: '6', essence_value: 0 }),
      viewItem({ id: '7' }),
    ];
    expect(deconstructFillCandidates(blocked, [], 100)).toEqual(['7']);
  });

  it('takes a burnable low-rarity material as well as gear', () => {
    const key = viewItem({ id: '8', def_id: 'map_key_incomum', category: 4, essence_value: 30, rarity: 1, level: 0 });
    expect(deconstructFillCandidates([key], [], 100)).toEqual(['8']);
  });
});

describe('one row per item id for every kind', () => {
  const raw = [
    gear({ id: '7001' }),
    gear({ id: '7002', def_id: 'map_key_incomum', category: 4, level: 0, essence_value: 30 }),
    gear({ id: '7003', def_id: 'map_key_incomum', category: 4, level: 0, essence_value: 30 }),
    gear({ id: '7004', def_id: 'forja_pedra_incomum', category: 8, level: 0, essence_value: 30 }),
    gear({ id: '7005', def_id: 'forja_pedra_incomum', category: 8, level: 0, essence_value: 30 }),
  ];
  const view = buildInventoryView(raw);

  it('keeps the two identical keys and the two identical chance stones as four separate rows', () => {
    expect(view.items.map((item) => item.id)).toEqual(['7001', '7002', '7003', '7004', '7005']);
  });

  it('is what the grouped display collapses, so the grouped entries are the wrong list to burn from', () => {
    const entryCount = view.groups.reduce((sum, group) => sum + group.entries.length, 0);
    expect(entryCount).toBe(3);
    expect(view.items).toHaveLength(5);
  });

  it('offers each of those rows to the autofill on its own', () => {
    expect(deconstructFillCandidates(view.items, [], 100)).toEqual(['7002', '7003', '7004', '7005', '7001']);
  });
});
