import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { noTeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { buildAccountRoster, type AccountRoster } from '../../lib/account/account-roster';
import { accountAroundHero } from '../../lib/account/account-shared';
import { heroFigures } from './hero-figures';
import { readHeroPhase } from './hero-phase';
import { createShareCardDps } from './share-card-dps';

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

/** What the Combat stage prints for one hero with the phase overridden and every switch off. */
function heroesScreenDps(roster: AccountRoster, heroId: string, phase: number): number | null {
  const figures = heroFigures(readHeroPhase({ ready: true, phase: null }, phase), roster, heroId);
  if (figures.kind !== 'at') return null;
  const hero = roster.heroes.find((entry) => entry.id === heroId);
  if (hero === undefined) return null;
  const account = accountAroundHero(figures.inputs.account, hero, noTeamAuraSwitches(), roster.heroes);
  return pipelineForHero(hero, account, figures.inputs.phase, figures.inputs.mitigationPct).dps;
}

describe('createShareCardDps', () => {
  const roster = offlineRoster();
  const allIds = roster.heroes.map((hero) => hero.id);

  it.each([1, 51, 137])('prints the Heroes screen DPS for every hero at phase %i', (phase) => {
    const dps = createShareCardDps(roster)(phase, allIds);
    const compared = allIds.filter((id) => heroesScreenDps(roster, id, phase) !== null);
    expect(compared.length).toBeGreaterThanOrEqual(3);
    for (const id of compared) expect(dps.get(id), id).toBe(heroesScreenDps(roster, id, phase));
  });

  it('gives no figure for a hero whose spent points were not read', () => {
    const withheld = roster.pointsUnrecovered.map((hero) => hero.id);
    expect(withheld.length).toBeGreaterThan(0);
    const dps = createShareCardDps(roster)(51, withheld);
    expect(dps.size).toBe(0);
  });

  it('moves with the phase', () => {
    const source = createShareCardDps(roster);
    const [first] = allIds.filter((id) => heroesScreenDps(roster, id, 51) !== null);
    if (first === undefined) throw new Error('expected a hero with figures');
    expect(source(51, [first]).get(first)).not.toBe(source(137, [first]).get(first));
  });

  it('answers only for the heroes asked about', () => {
    const [first] = allIds;
    if (first === undefined) throw new Error('expected a hero');
    expect([...createShareCardDps(roster)(51, [first]).keys()].every((id) => id === first)).toBe(true);
  });
});
