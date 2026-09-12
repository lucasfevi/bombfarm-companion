import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildAccountRoster, type AccountRoster } from './account-roster';
import { TEAM_BUFF_PER_LEVEL, noTeamAuraSwitches } from '@bombfarm/domain/team-buffs';
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
});

describe('accountAroundHero', () => {
  const block = buildAccountBlock(offlineRoster());
  if (block === null) throw new Error('expected the committed offline account to build a block');
  const me = { id: 'me', abilities: { grito_guerra: 4 } };
  const other = { id: 'other', abilities: { grito_guerra: 20 }, battleAllowed: true };

  it('counts the hero’s own aura with every switch off, and nothing of anyone else’s', () => {
    const account = accountAroundHero(block, me, [me, other], noTeamAuraSwitches());
    expect(account.teamBuffs.grito_guerra).toBe(4 * TEAM_BUFF_PER_LEVEL.grito_guerra);
    expect(account.tree).toBe(block.tree);
  });

  it('lets another fielded carrier in at full presence once its aura is switched on', () => {
    const switches = { ...noTeamAuraSwitches(), grito_guerra: true };
    const account = accountAroundHero(block, me, [me, other], switches);
    expect(account.teamBuffs.grito_guerra).toBe(24 * TEAM_BUFF_PER_LEVEL.grito_guerra);
  });
});
