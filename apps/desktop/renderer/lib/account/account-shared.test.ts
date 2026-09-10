import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildAccountRoster, type AccountRoster } from './account-roster';
import { buildAccountShared } from './account-shared';

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

describe('buildAccountShared', () => {
  it('carries the account read into the shape the per-hero maths takes', () => {
    const roster = offlineRoster();
    const shared = buildAccountShared(roster);

    expect(shared).not.toBeNull();
    expect(shared?.tree.danoTotal).toBe(roster.account.tree?.danoTotal);
    expect(shared?.context.houseIdx).toBe(roster.account.houseIdx);
    expect(shared?.context.houseLevel).toBe(roster.account.houseLevel);
    expect(shared?.maxPhase).toBe(roster.account.maxPhase ?? null);
  });

  it('leaves the phase out of the shared block — one block serves every hero, so it holds no stage', () => {
    const shared = buildAccountShared(offlineRoster());
    expect(shared?.context.phase).toBeNull();
  });

  it('derives the team auras from the roster rather than reading a stored total', () => {
    const shared = buildAccountShared(offlineRoster());
    expect(shared?.teamBuffs).toBeTypeOf('object');
    expect(shared?.teamBuffsOverride).toBeNull();
  });

  it('withholds the whole block when the skill tree was not read', () => {
    const roster = offlineRoster();
    expect(buildAccountShared({ ...roster, account: { ...roster.account, tree: null } })).toBeNull();
  });

  it('withholds the whole block when the House was not read', () => {
    const roster = offlineRoster();
    expect(buildAccountShared({ ...roster, account: { ...roster.account, houseIdx: null } })).toBeNull();
    expect(buildAccountShared({ ...roster, account: { ...roster.account, houseLevel: null } })).toBeNull();
  });

  it('omits the House slots key entirely rather than setting it undefined', () => {
    const roster = offlineRoster();
    const shared = buildAccountShared({ ...roster, account: { ...roster.account, slots: null } });
    expect(shared).not.toBeNull();
    expect(Object.hasOwn(shared as object, 'slots')).toBe(false);
  });
});
