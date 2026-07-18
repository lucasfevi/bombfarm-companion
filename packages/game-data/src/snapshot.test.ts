import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RawGameState, RawHeroEnergy, RawHeroRecord, RawInventoryBag } from '@bombfarm/contracts';
import { buildSnapshot } from './snapshot.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8')) as unknown;
}

describe('buildSnapshot', () => {
  it('merges state gold with inventory items', () => {
    const state = loadFixture('state-push-a.json') as RawGameState;
    const inventory = loadFixture('inventory-bag-v2.json') as RawInventoryBag;
    const heroRecord = loadFixture('hero-record.json') as RawHeroRecord;
    const heroEnergy = loadFixture('hero-energy.json') as RawHeroEnergy;

    const { snapshot } = buildSnapshot({
      takenAt: new Date().toISOString(),
      state,
      inventory,
      heroRecords: [heroRecord],
      heroEnergies: [heroEnergy],
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.gold).toBe(41091);
    expect(snapshot?.items.length).toBe(4);
    expect(snapshot?.heroes[0]?.energy?.current).toBeGreaterThan(0);
  });
});
