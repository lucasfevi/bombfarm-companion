import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildAccountRoster, type AccountRoster } from '../../lib/account/account-roster';
import { heroFigures } from './hero-figures';
import { readHeroPhase } from './hero-phase';

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

const farmAt = (phase: number | null) => ({ ready: true, phase });

describe('heroFigures', () => {
  it('computes at the phase the Farm screen has selected, and carries which phase that was', () => {
    const figures = heroFigures(readHeroPhase(farmAt(51), null), offlineRoster());

    expect(figures.kind).toBe('at');
    if (figures.kind !== 'at') return;
    expect(figures.selection).toEqual({ kind: 'farmScreen', phase: 51 });
    expect(figures.inputs.phase).toBe(51);
  });

  it('recomputes at the overridden phase, and says the phase came from the reader', () => {
    const figures = heroFigures(readHeroPhase(farmAt(51), 120), offlineRoster());

    expect(figures.kind).toBe('at');
    if (figures.kind !== 'at') return;
    expect(figures.selection).toEqual({ kind: 'override', phase: 120 });
    expect(figures.inputs.phase).toBe(120);
  });

  it('draws nothing while the Farm selection has not been read, and says nothing about the account', () => {
    expect(heroFigures(readHeroPhase({ ready: false, phase: null }, null), offlineRoster())).toEqual({
      kind: 'pending',
    });
  });

  it('draws no figures for a phase the application does not know', () => {
    expect(heroFigures(readHeroPhase(farmAt(51), Number.NaN), offlineRoster())).toEqual({
      kind: 'unknownPhase',
    });
  });

  it('blames the account, not the phase, when the account-wide block could not be built', () => {
    const roster = offlineRoster();
    const figures = heroFigures(readHeroPhase(farmAt(51), null), {
      ...roster,
      account: { ...roster.account, tree: null },
    });

    expect(figures).toEqual({ kind: 'withheld' });
  });

  it('never answers the same way for an unknown phase and an account that was not read', () => {
    const roster = offlineRoster();
    const unknownPhase = heroFigures(readHeroPhase(farmAt(51), Number.NaN), roster);
    const noAccount = heroFigures(readHeroPhase(farmAt(51), null), {
      ...roster,
      account: { ...roster.account, tree: null },
    });

    expect(unknownPhase.kind).not.toBe(noAccount.kind);
  });
});
