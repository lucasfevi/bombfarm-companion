import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildAccountRoster, type AccountRoster } from '../../lib/account/account-roster';
import { heroComputeInputs } from './hero-compute-inputs';

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

describe('heroComputeInputs', () => {
  it('carries the account block and the phase mitigation together', () => {
    const inputs = heroComputeInputs(offlineRoster(), 51);
    expect(inputs?.phase).toBe(51);
    expect(inputs?.mitigationPct).toBeGreaterThan(0);
    expect(inputs?.account.tree.danoTotal).toBeGreaterThan(0);
  });

  it('produces nothing for a phase the application does not know, so no figure is drawn for it', () => {
    expect(heroComputeInputs(offlineRoster(), null)).toBeNull();
  });

  it('produces nothing when the account-wide block could not be built', () => {
    const roster = offlineRoster();
    expect(heroComputeInputs({ ...roster, account: { ...roster.account, tree: null } }, 51)).toBeNull();
  });
});
