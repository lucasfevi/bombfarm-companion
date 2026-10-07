import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildAccountRoster, type AccountRoster } from './account-roster';
import { TEAM_BUFF_CAP, TEAM_BUFF_PER_LEVEL, noTeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { NO_COLLECTION, collectionSheetPct, type Collection } from '@bombfarm/domain/collection';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { accountAroundHero, buildAccountBlock } from './account-shared';

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlineRoster(): AccountRoster {
  const payload = JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
  const view: AccountView = {
    payload,
    gameRunning: false,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
  const roster = buildAccountRoster(view);
  if (roster === null) throw new Error('expected the committed offline account to parse');
  return roster;
}

describe('buildAccountBlock', () => {
  it('carries the account read into the shape the per-hero maths takes', () => {
    const roster = offlineRoster();
    const shared = buildAccountBlock(roster);

    expect(shared).not.toBeNull();
    expect(shared?.tree.danoTotal).toBe(roster.account.tree?.danoTotal);
    expect(shared?.context.houseIdx).toBe(roster.account.houseIdx);
    expect(shared?.context.houseLevel).toBe(roster.account.houseLevel);
    expect(shared?.maxPhase).toBe(roster.account.maxPhase ?? null);
  });

  it('leaves the phase out of the shared block — one block serves every hero, so it holds no stage', () => {
    const shared = buildAccountBlock(offlineRoster());
    expect(shared?.context.phase).toBeNull();
  });

  it('carries no team-aura total — that is overlaid per hero, from its own seat', () => {
    const shared = buildAccountBlock(offlineRoster());
    expect(Object.hasOwn(shared as object, 'teamBuffs')).toBe(false);
  });

  it('withholds the whole block when the skill tree was not read', () => {
    const roster = offlineRoster();
    expect(buildAccountBlock({ ...roster, account: { ...roster.account, tree: null } })).toBeNull();
  });

  it('withholds the whole block when the House was not read', () => {
    const roster = offlineRoster();
    expect(buildAccountBlock({ ...roster, account: { ...roster.account, houseIdx: null } })).toBeNull();
    expect(buildAccountBlock({ ...roster, account: { ...roster.account, houseLevel: null } })).toBeNull();
  });

  it('omits the House slots key entirely rather than setting it undefined', () => {
    const roster = offlineRoster();
    const shared = buildAccountBlock({ ...roster, account: { ...roster.account, slots: null } });
    expect(shared).not.toBeNull();
    expect(Object.hasOwn(shared as object, 'slots')).toBe(false);
  });

  describe('Collections and the XP multiplier', () => {
    const collection: Collection = { ...NO_COLLECTION, critChancePct: 10, energyPct: 10 };

    function rosterWithTree(extra: { collection?: Collection; xpMult?: number }): AccountRoster {
      const roster = offlineRoster();
      const tree = roster.account.tree;
      if (tree === null) throw new Error('expected the offline account to carry a tree');
      const { collection: _collection, xpMult: _xpMult, ...base } = tree;
      return { ...roster, account: { ...roster.account, tree: { ...base, ...extra } } };
    }

    function blockOf(roster: AccountRoster) {
      const shared = buildAccountBlock(roster);
      if (shared === null) throw new Error('expected a block');
      return shared;
    }

    it('carries the account Collection through to the block', () => {
      expect(blockOf(rosterWithTree({ collection })).tree.collection).toEqual(collection);
    });

    it('omits the Collection key when the account has none', () => {
      expect(Object.hasOwn(blockOf(rosterWithTree({})).tree, 'collection')).toBe(false);
    });

    it('carries the XP multiplier through, and omits the key when absent', () => {
      expect(blockOf(rosterWithTree({ xpMult: 1.25 })).tree.xpMult).toBe(1.25);
      expect(Object.hasOwn(blockOf(rosterWithTree({})).tree, 'xpMult')).toBe(false);
    });

    it('prices a hero with the Collection bonus in its figures', () => {
      const without = rosterWithTree({});
      const withBonus = rosterWithTree({ collection });
      const hero = without.heroes[0];
      if (hero === undefined) throw new Error('expected the offline account to carry a hero');
      const priced = (roster: AccountRoster) =>
        pipelineForHero(hero, accountAroundHero(blockOf(roster), hero, noTeamAuraSwitches(), roster.heroes), 10, 1);

      const base = priced(without);
      const bonus = priced(withBonus);
      expect(bonus.treeSheet.collection).toEqual(collectionSheetPct(collection));
      expect(base.treeSheet.collection).toEqual(collectionSheetPct(undefined));
      expect(bonus.adjusted.energy).toBeCloseTo(base.adjusted.energy * 1.1, 6);
      expect(bonus.adjusted.critChance).toBeCloseTo(base.adjusted.critChance * 1.1, 6);
    });
  });
});

describe('accountAroundHero', () => {
  const block = buildAccountBlock(offlineRoster());
  if (block === null) throw new Error('expected the committed offline account to build a block');
  const me = { id: 'me', abilities: { grito_guerra: 4 } };
  const roster = [
    { id: 'me', deployed: false },
    { id: 'a', deployed: true },
    { id: 'b', deployed: true },
    { id: 'c', deployed: false },
  ];

  it('counts the hero’s own aura at its rank with every switch off, and no other aura at all', () => {
    const account = accountAroundHero(block, me, noTeamAuraSwitches(), roster);
    expect(account.teamBuffs.grito_guerra).toBe(4 * TEAM_BUFF_PER_LEVEL.grito_guerra);
    expect(account.teamBuffs.folego_mineiro).toBe(0);
    expect(account.tree).toBe(block.tree);
  });

  it('prices a switched-on aura at its cap, whether or not the hero carries it', () => {
    const switches = { ...noTeamAuraSwitches(), grito_guerra: true, folego_mineiro: true };
    const account = accountAroundHero(block, me, switches, roster);
    expect(account.teamBuffs.grito_guerra).toBe(TEAM_BUFF_CAP.grito_guerra);
    expect(account.teamBuffs.folego_mineiro).toBe(TEAM_BUFF_CAP.folego_mineiro);
  });

  it('counts the heroes the game has deployed beside the hero as its allies, never the hero itself', () => {
    expect(accountAroundHero(block, me, noTeamAuraSwitches(), roster).fieldAllies).toBe(2);
    expect(accountAroundHero(block, { ...me, id: 'a' }, noTeamAuraSwitches(), roster).fieldAllies).toBe(1);
  });
});
