import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { rollQualityFor } from '@bombfarm/domain/roll-quality';
import { buildAccountRoster } from '../../lib/account/account-roster';
import { orderByRollQuality, rollQualityText, type RosterHeroRow } from './hero-roster-order';

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlineHeroes(): HeroRecord[] {
  const payload = JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
  const view: AccountView = {
    payload,
    gameRunning: false,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
  const roster = buildAccountRoster(view);
  if (roster === null) throw new Error('expected the committed offline account to parse');
  return roster.heroes;
}

function placeable(): HeroRecord {
  const hero = offlineHeroes().find((candidate) => rollQualityFor(candidate) !== undefined);
  if (hero === undefined) throw new Error('expected at least one hero the domain can place');
  return hero;
}

function withoutRollBounds(hero: HeroRecord): HeroRecord {
  const copy: HeroRecord = { ...hero };
  delete copy.statRanges;
  return copy;
}

describe('orderByRollQuality', () => {
  it('lists the best roll first', () => {
    const ordered = orderByRollQuality(offlineHeroes());
    const means = ordered.map((row) => row.report?.mean).filter((mean): mean is number => mean !== undefined);

    expect(means.length).toBeGreaterThan(1);
    expect([...means].sort((left, right) => right - left)).toEqual(means);
  });

  it('carries one roll-quality report per row, so the list and the detail panel read the same number', () => {
    const heroes = offlineHeroes();
    const ordered = orderByRollQuality(heroes);

    expect(ordered).toHaveLength(heroes.length);
    for (const row of ordered) {
      expect(row.report?.mean).toBe(rollQualityFor(row.hero)?.mean);
    }
  });

  it('puts a hero the domain could place nothing for last, never at the top as if it rolled perfectly', () => {
    const hero = placeable();
    const unplaceable = withoutRollBounds({ ...hero, id: 'aaa-unplaceable' });
    const ordered = orderByRollQuality([unplaceable, hero]);

    expect(ordered.map((row) => row.id)).toEqual([hero.id, 'aaa-unplaceable']);
  });

  it('breaks a tie by hero id, so two identically-rolled heroes hold their places between renders', () => {
    // Two copies of one hero: their roll quality is equal to the last digit, which is exactly the
    // case a comparator returning 0 leaves to the arrival order of the account read. Fed in
    // id-DESCENDING order, so a stable sort over such a comparator would preserve `b, a` — the
    // assertion below is `a, b` and fails under it.
    const hero = placeable();
    const first: HeroRecord = { ...hero, id: 'hero-a' };
    const second: HeroRecord = { ...hero, id: 'hero-b' };

    expect(rollQualityFor(first)?.mean).toBe(rollQualityFor(second)?.mean);
    expect(orderByRollQuality([second, first]).map((row) => row.id)).toEqual(['hero-a', 'hero-b']);
    expect(orderByRollQuality([first, second]).map((row) => row.id)).toEqual(['hero-a', 'hero-b']);
  });

  it('leaves the roster it was given untouched', () => {
    const heroes = offlineHeroes();
    const before = heroes.map((hero) => hero.id);
    orderByRollQuality(heroes);
    expect(heroes.map((hero) => hero.id)).toEqual(before);
  });
});

describe('rollQualityText', () => {
  function onlyRow(hero: HeroRecord): RosterHeroRow {
    const row = orderByRollQuality([hero])[0];
    if (row === undefined) throw new Error('expected one row');
    return row;
  }

  it('prints the same mean the detail panel places, to one decimal', () => {
    const row = onlyRow(placeable());
    expect(rollQualityText(row, 'en')).toBe((row.report?.mean ?? 0).toFixed(1));
  });

  it('prints a dash, never a zero, for a hero the domain could place nothing for', () => {
    expect(rollQualityText(onlyRow(withoutRollBounds(placeable())), 'en')).toBe('—');
  });
});
