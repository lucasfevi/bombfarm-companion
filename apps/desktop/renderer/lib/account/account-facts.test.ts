import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountSection, AccountView } from '@bombfarm/contracts';
import { accountFactsFrom, capturedAtOf, isSectionUsable } from './account-facts';

const NOW = '2026-08-12T00:00:00.000Z';
const EARLIER = '2026-08-11T00:00:00.000Z';

function resolvedFidelity(overrides: Partial<AccountFidelity> = {}): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt: NOW },
    heroes: { status: 'resolved', capturedAt: NOW },
    skills: { status: 'resolved', capturedAt: NOW },
    casa: { status: 'resolved', capturedAt: NOW },
    items: { status: 'resolved', capturedAt: NOW },
    ...overrides,
  };
}

function rawHero(id: string, overrides: Record<string, unknown> = {}) {
  return { id, name: id, level: 10, rarity: 2, stars: 1, skin: 0, marketable: false, ...overrides };
}

function rawItem(id: string, overrides: Record<string, unknown> = {}) {
  return { id, def_id: 'espada_ferro', rarity: 2, category: 0, tradable: true, ...overrides };
}

function basePayload(fidelity: AccountFidelity = resolvedFidelity()): AccountPayload {
  return {
    account: { phase: 60, max_phase: 88, player_name: 'Tester', account_id: 1 },
    heroes: [rawHero('h1')],
    skills: {
      field_slots: 6,
      max_phase: 12,
      totals: {
        dmg_static: 1.5,
        crit_chance_add: 0.1,
        crit_dmg_add: 0.25,
        speed_add: 0.2,
        energia_add: 0.3,
        coin_add: 0.4,
        xp_mult: 1.25,
        luck_add: 0.05,
        team_dmg_add: 0.179,
        geo_mult: 1.0258,
        vagas_campo: 5,
        bag_tabs_bonus: 2,
      },
    },
    casa: { active_casa: 1, levels: [10], slots: 3, cycle_secs: 1168 },
    items: [rawItem('i1')],
    fidelity,
  };
}

function viewOf(payload: AccountPayload): AccountView {
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

const factsOf = (payload: AccountPayload) => accountFactsFrom(viewOf(payload));

/** What each part of the screen looks like once a section is taken away. */
function drawnParts(payload: AccountPayload) {
  const facts = factsOf(payload);
  return {
    identity: facts.identity !== null,
    house: facts.house !== null,
    tree: facts.tree !== null,
    inventory: facts.holdings.inventory !== null,
    heroes: facts.holdings.heroes !== null,
    skins: facts.holdings.skinsWorn !== null,
  };
}

const EVERYTHING_DRAWN = {
  identity: true,
  house: true,
  tree: true,
  inventory: true,
  heroes: true,
  skins: true,
} as const;

describe('the account facts every part of the screen is drawn from', () => {
  it('draws every part when every section was read', () => {
    expect(drawnParts(basePayload())).toEqual(EVERYTHING_DRAWN);
  });

  it('reads identity, House, tree and the inventory out of one payload', () => {
    const facts = factsOf(basePayload());
    expect(facts.identity).toEqual({
      playerName: 'Tester',
      accountId: '1',
      phase: 60,
      maxPhase: 88,
    });
    expect(facts.house).toEqual({ houseIndex: 0, houseLevel: 10, slots: 3, restSeconds: 1168 });
    expect(facts.tree?.totalDamage).toBe(1.5);
    expect(facts.tree?.squadDamagePct).toBeCloseTo(17.9, 6);
    expect(facts.tree?.fieldSlots).toBe(6);
    expect(facts.holdings.inventory).toEqual([{ defId: 'espada_ferro', rarity: 2, tradable: true }]);
  });
});

describe('each part withholds on its own sections, and on no others', () => {
  const withheldBy: Record<AccountSection, readonly (keyof typeof EVERYTHING_DRAWN)[]> = {
    account: ['identity'],
    casa: ['house'],
    skills: ['tree'],
    heroes: ['heroes', 'skins'],
    items: ['inventory'],
  };

  it.each(Object.keys(withheldBy) as AccountSection[])(
    'an unread %s section takes away exactly the parts that read it',
    (section) => {
      const payload = basePayload(resolvedFidelity({ [section]: { status: 'missing' } }));
      expect(drawnParts(payload)).toEqual({
        ...EVERYTHING_DRAWN,
        ...Object.fromEntries(withheldBy[section].map((part) => [part, false])),
      });
    },
  );

  it('a stale inventory leaves the skill tree on screen — the whole reason the gate is per part', () => {
    const payload = basePayload(resolvedFidelity({ items: { status: 'missing' } }));
    expect(factsOf(payload).tree).not.toBeNull();
    expect(factsOf(payload).holdings.inventory).toBeNull();
  });

  it('a section that is stale rather than absent is still read — last-known-good is data', () => {
    const payload = basePayload(resolvedFidelity({ casa: { status: 'stale', capturedAt: EARLIER } }));
    expect(factsOf(payload).house).not.toBeNull();
  });

  it('a degraded section that lost a key withholds, even though its body is right there', () => {
    const payload = basePayload(
      resolvedFidelity({
        skills: { status: 'degraded', capturedAt: NOW, missingKeys: ['totals.geo_mult'], addedKeys: [] },
      }),
    );
    expect(payload.skills).toBeDefined();
    expect(factsOf(payload).tree).toBeNull();
  });

  it('a degraded section that only gained a key is still read', () => {
    const payload = basePayload(
      resolvedFidelity({
        skills: { status: 'degraded', capturedAt: NOW, missingKeys: [], addedKeys: ['totals.soulbound'] },
      }),
    );
    expect(factsOf(payload).tree).not.toBeNull();
  });
});

describe('a value the account did not carry is withheld, never defaulted', () => {
  it('withholds the House when the payload carries no house at all', () => {
    const payload: AccountPayload = { ...basePayload(), casa: {} };
    expect(factsOf(payload).house).toBeNull();
  });

  it('withholds the skill tree when the payload carries no totals', () => {
    const payload: AccountPayload = { ...basePayload(), skills: { field_slots: 6 } };
    expect(factsOf(payload).tree).toBeNull();
  });

  it('leaves the field width null rather than inventing one, and still draws the tree', () => {
    const base = basePayload();
    const payload: AccountPayload = {
      ...base,
      skills: { totals: (base.skills as Record<string, unknown>).totals },
    };
    expect(factsOf(payload).tree?.fieldSlots).toBeNull();
  });

  it('prints no name for an account that carried none, rather than withholding the panel', () => {
    const payload: AccountPayload = { ...basePayload(), account: { phase: 60, max_phase: 88 } };
    expect(factsOf(payload).identity).toEqual({
      playerName: null,
      accountId: null,
      phase: 60,
      maxPhase: 88,
    });
  });

  it('does not take the furthest phase off an unread skill section', () => {
    const payload = basePayload(resolvedFidelity({ skills: { status: 'missing' } }));
    const withoutAccountMaxPhase: AccountPayload = { ...payload, account: { phase: 60 } };
    expect(factsOf(withoutAccountMaxPhase).identity?.maxPhase).toBeNull();
  });

  it('takes the furthest phase off the skill section when that section was read', () => {
    const base = basePayload();
    const withoutAccountMaxPhase: AccountPayload = { ...base, account: { phase: 60 } };
    expect(factsOf(withoutAccountMaxPhase).identity?.maxPhase).toBe(12);
  });
});

describe('a roster the parser rejects cannot take the rest of the account down with it', () => {
  it('still draws identity, House and tree when no hero carries birth stats', () => {
    const payload: AccountPayload = { ...basePayload(), heroes: [rawHero('h1'), rawHero('h2')] };
    const facts = factsOf(payload);
    expect(facts.identity).not.toBeNull();
    expect(facts.house).not.toBeNull();
    expect(facts.tree).not.toBeNull();
  });

  it('withholds the roster-priced parts when the payload carries no hero list at all', () => {
    const payload: AccountPayload = { ...basePayload(), heroes: undefined };
    expect(factsOf(payload).holdings.heroes).toBeNull();
    expect(factsOf(payload).holdings.skinsWorn).toBeNull();
    expect(factsOf(payload).tree).not.toBeNull();
  });
});

describe('the sellable flag the game itself sends', () => {
  it('carries each hero rarity and the game’s own answer to whether it may be listed', () => {
    const payload: AccountPayload = {
      ...basePayload(),
      heroes: [rawHero('h1', { rarity: 4, marketable: true }), rawHero('h2', { rarity: 2 })],
    };
    const listable = factsOf(payload).holdings.heroes?.map(({ name, rarity, marketable }) => ({
      name,
      rarity,
      marketable,
    }));

    expect(listable).toEqual([
      { name: 'h1', rarity: 4, marketable: true },
      { name: 'h2', rarity: 2, marketable: false },
    ]);
  });

  it('treats a hero row that carries no flag as unsellable rather than guessing', () => {
    const payload: AccountPayload = {
      ...basePayload(),
      heroes: [{ id: 'h1', rarity: 3 }],
    };
    expect(factsOf(payload).holdings.heroes).toEqual([{ name: '—', rarity: 3, marketable: false }]);
  });

  it('carries what it takes to depict a hero, the way every other screen depicts one', () => {
    const payload: AccountPayload = {
      ...basePayload(),
      heroes: [rawHero('h1', { rank: 'S', level: 42, stars: 3, skin: 4 })],
    };
    expect(factsOf(payload).holdings.heroes).toEqual([
      { name: 'h1', rarity: 2, marketable: false, rank: 'S', level: 42, stars: 3, skin: 4 },
    ]);
  });

  it('leaves out a depiction field the roster row did not carry, rather than inventing one', () => {
    const payload: AccountPayload = {
      ...basePayload(),
      heroes: [{ id: 'h1', name: 'Nim', rarity: 3, rank: 7, level: 'twelve' }],
    };
    const [hero] = factsOf(payload).holdings.heroes ?? [];

    expect(hero?.name).toBe('Nim');
    expect(hero?.rank).toBeUndefined();
    expect(hero?.level).toBeUndefined();
    expect(hero?.skin).toBeUndefined();
  });

  it('reads every worn skin, leaving the collapsing to the shared computation', () => {
    const payload: AccountPayload = {
      ...basePayload(),
      heroes: [rawHero('h1', { skin: 4 }), rawHero('h2', { skin: 4 }), rawHero('h3', { skin: 0 })],
    };
    expect(factsOf(payload).holdings.skinsWorn).toEqual([4, 4, 0]);
  });
});

describe('how old the account read is', () => {
  it('names the oldest capture, so the line never reads fresher than the stalest part', () => {
    const payload = basePayload(resolvedFidelity({ casa: { status: 'stale', capturedAt: EARLIER } }));
    expect(factsOf(payload).readCapturedAt).toBe(EARLIER);
  });

  it('is the shared capture when every section was read at once', () => {
    expect(factsOf(basePayload()).readCapturedAt).toBe(NOW);
  });

  it('is null when no section carries a capture at all', () => {
    const allMissing = {
      account: { status: 'missing' },
      heroes: { status: 'missing' },
      skills: { status: 'missing' },
      casa: { status: 'missing' },
      items: { status: 'missing' },
    } as const satisfies AccountFidelity;
    expect(factsOf(basePayload(allMissing)).readCapturedAt).toBeNull();
  });
});

describe('the per-section reads the farm board shares with this screen', () => {
  it.each([
    ['resolved', { status: 'resolved', capturedAt: NOW }, true],
    ['stale', { status: 'stale', capturedAt: NOW }, true],
    ['missing', { status: 'missing' }, false],
    ['degraded, missing key', { status: 'degraded', capturedAt: NOW, missingKeys: ['gold'], addedKeys: [] }, false],
    ['degraded, added key only', { status: 'degraded', capturedAt: NOW, missingKeys: [], addedKeys: ['gold'] }, true],
  ] as const)('%s is usable=%s', (_label, fidelity, expected) => {
    expect(isSectionUsable(fidelity)).toBe(expected);
  });

  it('reads a section’s capture time, and none for a section never seen', () => {
    const payload = basePayload(resolvedFidelity({ items: { status: 'missing' } }));
    expect(capturedAtOf(payload, 'casa')).toBe(NOW);
    expect(capturedAtOf(payload, 'items')).toBeNull();
  });
});
