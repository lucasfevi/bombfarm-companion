import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RawGameState, RawHeroRecord } from '@bombfarm/contracts';
import {
  attributeHpDeltaDamage,
  computeHeroFt,
  resolveBombOwner,
  summarizeProvenance,
} from './attribution/index.js';
import { buildFtOwnershipMap } from './attribution/bomb-ownership.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

function loadFixture(name: string): RawGameState {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8')) as RawGameState;
}

describe('STA-7 damage attribution', () => {
  it('uses unique ft ownership when heroes have distinct cooldown_reduction', () => {
    const heroes: RawHeroRecord[] = [
      { id: '1', stats: { cooldown_reduction: 0.1 } },
      { id: '2', stats: { cooldown_reduction: 0.2 } },
    ];
    const ftOwnership = buildFtOwnershipMap(heroes);
    const bomb = { c: 10, r: 1, ft: computeHeroFt(0.1) };
    const owner = resolveBombOwner(bomb, ftOwnership, [{ id: '1', c: 10 }]);
    expect(owner).toBe('1');
  });

  it('attributes hp-grid damage with provenance on fixture transitions', () => {
    const prev = loadFixture('attribution-prev.json');
    const cur = loadFixture('attribution-cur.json');
    const heroes: RawHeroRecord[] = [
      { id: 'hero-a', stats: { cooldown_reduction: 0.075 } },
      { id: 'hero-b', stats: { cooldown_reduction: 0.2 } },
    ];

    const result = attributeHpDeltaDamage(prev, cur, heroes);
    expect(result.total).toBeGreaterThan(0);
    expect(result.chunks.length).toBeGreaterThan(0);
    const provenance = summarizeProvenance(result.chunks);
    expect(
      provenance.dying_bomb_footprint +
        provenance.invisible_cell_cross +
        provenance.unattributed,
    ).toBe(result.total);
  });

  it('routes ambiguous overlap damage to unattributed bucket', () => {
    const prev: RawGameState = {
      t: 'snap',
      gold: '1',
      kinds: [0, 0, 0, -1],
      hps: [100, 100, 100, 0],
      bombs: [
        { c: 0, r: 1, ft: 1.8 },
        { c: 2, r: 1, ft: 1.6 },
      ],
      heroes: [{ id: 'a', c: 0 }, { id: 'b', c: 2 }],
    };
    const cur: RawGameState = {
      t: 'snap',
      gold: '1',
      kinds: [0, 0, 0, -1],
      hps: [50, 40, 50, 0],
      bombs: [],
      heroes: [{ id: 'a', c: 0 }, { id: 'b', c: 2 }],
    };
    const heroes: RawHeroRecord[] = [
      { id: 'a', stats: { cooldown_reduction: 0.1 } },
      { id: 'b', stats: { cooldown_reduction: 0.2 } },
    ];
    const result = attributeHpDeltaDamage(prev, cur, heroes);
    expect(result.unattributed).toBeGreaterThan(0);
    expect(result.chunks.some((chunk) => chunk.identifiedBy === 'unattributed')).toBe(true);
  });
});
