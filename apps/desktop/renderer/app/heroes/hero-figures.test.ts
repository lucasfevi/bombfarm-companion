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
function heroAt(roster: AccountRoster, index: number) {
  const hero = roster.heroes[index];
  if (hero === undefined) throw new Error(`expected the committed offline account to hold hero #${String(index)}`);
  return hero;
}

/** The offline account's first hero — its points read fine, so it stands in wherever the hero is not the question. */
const FIRST_HERO = heroAt(offlineRoster(), 0).id;

describe('heroFigures', () => {
  it('computes at the phase the Farm screen has selected, and carries which phase that was', () => {
    const figures = heroFigures(readHeroPhase(farmAt(51), null), offlineRoster(), FIRST_HERO);

    expect(figures.kind).toBe('at');
    if (figures.kind !== 'at') return;
    expect(figures.selection).toEqual({ kind: 'farmScreen', phase: 51 });
    expect(figures.inputs.phase).toBe(51);
  });

  it('recomputes at the overridden phase, and says the phase came from the reader', () => {
    const figures = heroFigures(readHeroPhase(farmAt(51), 120), offlineRoster(), FIRST_HERO);

    expect(figures.kind).toBe('at');
    if (figures.kind !== 'at') return;
    expect(figures.selection).toEqual({ kind: 'override', phase: 120 });
    expect(figures.inputs.phase).toBe(120);
  });

  it('draws nothing while the Farm selection has not been read, and says nothing about the account', () => {
    expect(heroFigures(readHeroPhase({ ready: false, phase: null }, null), offlineRoster(), FIRST_HERO)).toEqual({
      kind: 'pending',
    });
  });

  it('draws no figures for a phase the application does not know', () => {
    expect(heroFigures(readHeroPhase(farmAt(51), Number.NaN), offlineRoster(), FIRST_HERO)).toEqual({
      kind: 'unknownPhase',
    });
  });

  it('blames the account, not the phase, when the account-wide block could not be built', () => {
    const roster = offlineRoster();
    const figures = heroFigures(
      readHeroPhase(farmAt(51), null),
      { ...roster, account: { ...roster.account, tree: null } },
      FIRST_HERO,
    );

    expect(figures).toEqual({ kind: 'withheld' });
  });

  it('withholds every figure for a hero whose spent points could not be read, and says so about the hero', () => {
    const roster = offlineRoster();
    const hero = heroAt(roster, 0);
    const figures = heroFigures(
      readHeroPhase(farmAt(51), null),
      { ...roster, pointsUnrecovered: [{ id: hero.id, name: hero.name }] },
      hero.id,
    );

    expect(figures).toEqual({ kind: 'pointsUnread' });
    // The next hero over is unaffected — the answer is about the hero, not the account.
    expect(
      heroFigures(
        readHeroPhase(farmAt(51), null),
        { ...roster, pointsUnrecovered: [{ id: hero.id, name: hero.name }] },
        heroAt(roster, 1).id,
      ).kind,
    ).toBe('at');
  });

  it('never answers the same way for an unknown phase and an account that was not read', () => {
    const roster = offlineRoster();
    const unknownPhase = heroFigures(readHeroPhase(farmAt(51), Number.NaN), roster, FIRST_HERO);
    const noAccount = heroFigures(
      readHeroPhase(farmAt(51), null),
      { ...roster, account: { ...roster.account, tree: null } },
      FIRST_HERO,
    );

    expect(unknownPhase.kind).not.toBe(noAccount.kind);
  });
});
