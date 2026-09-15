/**
 * The override made on the Heroes screen is view-local: it changes what that screen computes and
 * nothing else. Two independent proofs, because either one alone can go green while the other
 * fails — a value assertion cannot see a write that happens on a path this test does not walk,
 * and a structural check cannot see a value that was already wrong before anyone wrote it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadFarmView, saveFarmView } from '../../lib/farm/farm-view-storage';
import { readHeroPhase, type FarmPhaseSelection } from './hero-phase';

const FARM_VIEW_KEY = 'bfc-farm-view';
const HEROES_DIR = __dirname;

type FakeWindow = { localStorage: Storage };

function installStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as Storage;
  (globalThis as unknown as { window?: FakeWindow }).window = { localStorage: storage };
  return entries;
}

describe('an override on the Heroes screen leaves the Farm screen stored phase alone', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = installStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });

  it('the stored view is byte-for-byte what it was, after the screen has recomputed at another phase', () => {
    saveFarmView({ farmPoolOverrides: { h1: false }, farmReturnBonus: 'vip', selectedPhase: 51 });
    const storedBefore = entries.get(FARM_VIEW_KEY);

    const farm: FarmPhaseSelection = { ready: true, phase: loadFarmView().selectedPhase };
    const overridden = readHeroPhase(farm, 120);

    expect(overridden).toEqual({ kind: 'at', selection: { kind: 'override', phase: 120 } });
    // The stored value, not a setter that went uncalled: a write through some other path would
    // still have moved this string.
    expect(entries.get(FARM_VIEW_KEY)).toBe(storedBefore);
    expect(loadFarmView().selectedPhase).toBe(51);
  });

  it('the Farm selection still governs the screen once the override is cleared', () => {
    saveFarmView({ farmPoolOverrides: {}, farmReturnBonus: 'off', selectedPhase: 51 });

    const farm: FarmPhaseSelection = { ready: true, phase: loadFarmView().selectedPhase };
    readHeroPhase(farm, 120);

    expect(readHeroPhase({ ready: true, phase: loadFarmView().selectedPhase }, null)).toEqual({
      kind: 'at',
      selection: { kind: 'farmScreen', phase: 51 },
    });
  });
});

describe('nothing on the Heroes screen can write the Farm view at all', () => {
  /** The screen's own modules — the tests beside them are excluded because this file is one of
   *  them and imports the writer deliberately, to prove the stored value did not move. */
  function heroesSources(): { name: string; source: string }[] {
    return readdirSync(HEROES_DIR)
      .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
      .filter((name) => !name.includes('.test.'))
      .map((name) => ({ name, source: readFileSync(path.join(HEROES_DIR, name), 'utf8') }));
  }

  it('no module in this screen reaches for the Farm view writer', () => {
    const offenders = heroesSources()
      .filter((file) => /\bsaveFarmView\b/.test(file.source))
      .map((file) => file.name);

    expect(
      offenders,
      `These modules can write the Farm screen's stored view: ${offenders.join(', ')}. The phase ` +
        `override is view-local and this feature persists nothing.`,
    ).toEqual([]);
  });

  it('red state demonstrated: a module that did reach for it is caught by the same check', () => {
    const fixture = [{ name: 'leak.ts', source: 'saveFarmView({ selectedPhase: 9 });' }];
    expect(fixture.filter((file) => /\bsaveFarmView\b/.test(file.source)).map((f) => f.name)).toEqual([
      'leak.ts',
    ]);
  });

  it('the screen really does read the Farm view, so the check above is guarding a live path', () => {
    const readers = heroesSources().filter((file) => /\bloadFarmView\b/.test(file.source));
    expect(readers.map((file) => file.name)).toContain('use-farm-selected-phase.ts');
  });
});
