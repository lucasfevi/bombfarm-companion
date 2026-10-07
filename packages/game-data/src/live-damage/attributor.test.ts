import { describe, expect, it } from 'vitest';
import type { CreditAmounts, LiveBomb, LiveHit, LiveLootPop, LiveTick, LiveTickHero, UnattributedReason } from '@bombfarm/contracts';
import { createLiveDamageAttributor, type FrameCredit, type LiveDamageAttributor } from './attributor.js';
import type { RosterCombatFact } from './roster-facts.js';

const FUSE = 1.6;
const ALL_REASONS: readonly UnattributedReason[] = [
  'noOwnerAtBirth',
  'explosionWithoutBomb',
  'streamDiscontinuity',
  'unresolvedOverlap',
  'explosionlessWithoutFantasma',
  'sharedOrUnattributedKill',
  'noHitOnLootCell',
];

const hero = (id: string, cell: number): LiveTickHero => ({ id, cell });
const freshBomb = (cell: number, fuseTotalSeconds = FUSE): LiveBomb => ({
  cell,
  radius: 2,
  fuseRemainingSeconds: fuseTotalSeconds - 0.1,
  fuseTotalSeconds,
});
const burningBomb = (cell: number, fuseRemainingSeconds: number, fuseTotalSeconds = FUSE): LiveBomb => ({
  cell,
  radius: 2,
  fuseRemainingSeconds,
  fuseTotalSeconds,
});
const blast = (cell: number) => ({ cell, radius: 2 });
const hit = (cell: number, damage: number, extra: Partial<LiveHit> = {}): LiveHit => ({ cell, damage, ...extra });
const tick = (parts: Partial<LiveTick> = {}): LiveTick => ({ heroes: [], ...parts });
const fact = (id: string, cooldownReduction: number | undefined, carriesFantasma = false): RosterCombatFact =>
  cooldownReduction === undefined ? { id, carriesFantasma } : { id, cooldownReduction, carriesFantasma };

const feed = (attributor: LiveDamageAttributor, parts: Partial<LiveTick> = {}, discontinuous = false) =>
  attributor.consume(tick(parts), { discontinuous });

const sumOf = (amounts: Iterable<CreditAmounts>): CreditAmounts => {
  const total = { damage: 0, props: 0, gold: 0 };
  for (const entry of amounts) {
    total.damage += entry.damage;
    total.props += entry.props;
    total.gold += entry.gold;
  }
  return total;
};

function expectReconciled(credit: FrameCredit): void {
  const accounted = sumOf([...credit.perHero.values(), ...Object.values(credit.unattributed)]);
  expect(accounted).toEqual(credit.team);
}

describe('createLiveDamageAttributor — input handling', () => {
  it('treats a tick without bombs, explosions, hits or loot as empty', () => {
    const credit = feed(createLiveDamageAttributor(), { heroes: [hero('A', 3)] });
    expect(credit.team).toEqual({ damage: 0, props: 0, gold: 0 });
    expect(credit.bombs).toEqual({ births: 0, adopted: 0, owned: 0, cellOwnerConflicts: 0 });
    expect(credit.hits).toEqual({ total: 0, attributed: 0 });
  });

  it('credits a tick with hits but no explosions through the ghost rule or leaves it unattributed', () => {
    const credit = feed(createLiveDamageAttributor(), { heroes: [hero('A', 3)], hits: [hit(3, 5)] });
    expect(credit.team.damage).toBe(5);
    expect(credit.unattributed.explosionlessWithoutFantasma.damage).toBe(5);
  });

  it('reports the hero ids of the tick, in order, as present', () => {
    const credit = feed(createLiveDamageAttributor(), { heroes: [hero('B', 1), hero('A', 2), hero('C', 3)] });
    expect(credit.present).toEqual(['B', 'A', 'C']);
  });

  it('starts every Unattributed reason at zero', () => {
    const credit = feed(createLiveDamageAttributor());
    expect(Object.keys(credit.unattributed).sort()).toEqual([...ALL_REASONS].sort());
    for (const reason of ALL_REASONS) expect(credit.unattributed[reason]).toEqual({ damage: 0, props: 0, gold: 0 });
  });

  it('counts every hit in hits.total and the credited ones in hits.attributed', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    const credit = feed(attributor, {
      heroes: [hero('A', 100)],
      explosions: [blast(100)],
      hits: [hit(101, 10), hit(98, 20), hit(300, 30)],
    });
    expect(credit.hits).toEqual({ total: 3, attributed: 2 });
  });

  it('counts team props and gold only for loot with valid gold', () => {
    const loot: LiveLootPop[] = [{ cell: 1, gold: 100 }, { cell: 2 }, { cell: 3, gold: Number.NaN }, { cell: 4, gold: 50 }];
    const credit = feed(createLiveDamageAttributor(), { loot });
    expect(credit.team).toEqual({ damage: 0, props: 2, gold: 150 });
    expectReconciled(credit);
  });
});

describe('createLiveDamageAttributor — credit through ownership', () => {
  it('credits damage, props and gold to the hero who planted the bomb that blasted the cell', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    const credit = feed(attributor, {
      heroes: [hero('A', 100)],
      explosions: [blast(100)],
      hits: [hit(101, 40)],
      loot: [{ cell: 101, gold: 25 }],
    });
    expect(credit.perHero.get('A')).toEqual({ damage: 40, props: 1, gold: 25 });
    expect(credit.team).toEqual({ damage: 40, props: 1, gold: 25 });
    expectReconciled(credit);
  });

  it('credits a blast to the bomb it replaced at the same cell, not to the newcomer', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 5)], bombs: [freshBomb(5, 1.6)] });
    const credit = feed(attributor, {
      heroes: [hero('B', 5)],
      bombs: [freshBomb(5, 1.2)],
      explosions: [blast(5)],
      hits: [hit(6, 30)],
    });
    expect(credit.perHero.get('A')?.damage).toBe(30);
    expect(credit.perHero.has('B')).toBe(false);
  });

  it('keeps crediting a hero who left the field while its bomb still burned', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    const burning = feed(attributor, { heroes: [], bombs: [burningBomb(100, FUSE - 0.3)] });
    const credit = feed(attributor, { heroes: [], explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(burning.present).toEqual([]);
    expect(credit.present).toEqual([]);
    expect(credit.perHero.get('A')?.damage).toBe(40);
  });

  it('leaves a lost stretch unattributed rather than crediting the earlier bomb owner', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    const credit = feed(attributor, { heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 40)] }, true);
    expect(credit.perHero.size).toBe(0);
    expect(credit.unattributed.streamDiscontinuity.damage).toBe(40);
  });

  it('seeds a fingerprint from the roster so a unique fuse total owns a bomb the cell would name differently', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([fact('A', 0.2), fact('B', 0.5)]);
    const birth = feed(attributor, { heroes: [hero('A', 7), hero('B', 100)], bombs: [freshBomb(100, 1.6)] });
    const credit = feed(attributor, { heroes: [hero('A', 7), hero('B', 100)], explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(birth.bombs.cellOwnerConflicts).toBe(1);
    expect(credit.perHero.get('A')?.damage).toBe(40);
    expect(credit.perHero.has('B')).toBe(false);
  });

  it('falls back to the hero on the cell when two roster heroes share a fuse total', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([fact('A', 0.2), fact('B', 0.2)]);
    feed(attributor, { heroes: [hero('A', 7), hero('B', 100)], bombs: [freshBomb(100, 1.6)] });
    const credit = feed(attributor, { heroes: [hero('A', 7), hero('B', 100)], explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(credit.perHero.get('B')?.damage).toBe(40);
  });

  it('reports the disagreement between a seed and the learned fuse once per hero', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([fact('A', 0.2)]);
    const first = feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100, 1.5)] });
    const second = feed(attributor, { heroes: [hero('A', 100)], bombs: [burningBomb(100, 1.2, 1.5), freshBomb(120, 1.5)] });
    expect(first.disagreements).toEqual([{ heroId: 'A', seeded: 1.6, learned: 1.5 }]);
    expect(second.disagreements).toEqual([]);
  });

  it('counts births, adopted bombs and owned births of a frame', () => {
    const attributor = createLiveDamageAttributor();
    const credit = feed(attributor, {
      heroes: [hero('A', 100)],
      bombs: [freshBomb(100), freshBomb(120, 1.3), burningBomb(140, 0.5)],
    });
    expect(credit.bombs).toEqual({ births: 2, adopted: 1, owned: 1, cellOwnerConflicts: 0 });
  });
});

describe('createLiveDamageAttributor — roster', () => {
  const ghostFrame = { heroes: [hero('G', 300)], hits: [hit(300, 42)] };

  it('treats the roster as unknown before setRoster, so a ghost hit is unattributed', () => {
    const credit = feed(createLiveDamageAttributor(), ghostFrame);
    expect(credit.unattributed.explosionlessWithoutFantasma.damage).toBe(42);
  });

  it('credits a Fantasma carrier standing on an explosion-less hit once the roster says so', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([fact('G', 0.1, true), fact('H', 0.1)]);
    expect(feed(attributor, ghostFrame).perHero.get('G')?.damage).toBe(42);
  });

  it('does not credit a hero whose roster entry lacks Fantasma', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([fact('G', 0.1, false)]);
    expect(feed(attributor, ghostFrame).unattributed.explosionlessWithoutFantasma.damage).toBe(42);
  });

  it('treats an empty roster as unknown again', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([fact('G', 0.1, true)]);
    attributor.setRoster([]);
    expect(feed(attributor, ghostFrame).unattributed.explosionlessWithoutFantasma.damage).toBe(42);
  });

  it('applies a roster that arrives after frames have started from then on and re-credits nothing', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 50)], bombs: [burningBomb(100, 0.9)] });
    const before = feed(attributor, { heroes: [hero('A', 50)], explosions: [blast(100)], hits: [hit(101, 40)] });
    const snapshot = structuredClone(before);

    attributor.setRoster([fact('A', 0.2)]);
    expect(before).toEqual(snapshot);
    expect(before.unattributed.noOwnerAtBirth.damage).toBe(40);

    feed(attributor, { heroes: [hero('A', 50)], bombs: [burningBomb(120, 0.9)] });
    const after = feed(attributor, { heroes: [hero('A', 50)], explosions: [blast(120)], hits: [hit(121, 40)] });
    expect(after.perHero.get('A')?.damage).toBe(40);
  });
});

describe('createLiveDamageAttributor — forgetting', () => {
  const learnFingerprint = (attributor: LiveDamageAttributor) => {
    feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    feed(attributor, { heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 77)] });
  };
  const overlapOutcome = (attributor: LiveDamageAttributor, damage: number) => {
    feed(attributor, {
      heroes: [hero('A', 100), hero('B', 102)],
      bombs: [freshBomb(100, 1.6), freshBomb(102, 1.4)],
    });
    return feed(attributor, {
      heroes: [hero('A', 100), hero('B', 102)],
      explosions: [blast(100), blast(102)],
      hits: [hit(101, damage)],
    });
  };

  it('keeps the damage signatures when only the live bombs are forgotten', () => {
    const attributor = createLiveDamageAttributor();
    learnFingerprint(attributor);
    attributor.forgetLiveBombs();
    expect(overlapOutcome(attributor, 77).perHero.get('A')?.damage).toBe(77);
  });

  it('forgets the damage signatures on clear', () => {
    const attributor = createLiveDamageAttributor();
    learnFingerprint(attributor);
    attributor.clear();
    expect(overlapOutcome(attributor, 77).unattributed.unresolvedOverlap.damage).toBe(77);
  });

  it('forgets live and retired bombs on forgetLiveBombs, so their blast has no owner', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    attributor.forgetLiveBombs();
    const credit = feed(attributor, { heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(credit.unattributed.explosionWithoutBomb.damage).toBe(40);
  });

  it('keeps learned fingerprints when only the live bombs are forgotten', () => {
    const attributor = createLiveDamageAttributor();
    learnFingerprint(attributor);
    attributor.forgetLiveBombs();
    feed(attributor, { heroes: [hero('A', 7), hero('B', 100)], bombs: [burningBomb(100, 0.9)] });
    const credit = feed(attributor, { heroes: [hero('A', 7), hero('B', 100)], explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(credit.perHero.get('A')?.damage).toBe(40);
  });

  it('forgets learned fingerprints on clear', () => {
    const attributor = createLiveDamageAttributor();
    learnFingerprint(attributor);
    attributor.clear();
    feed(attributor, { heroes: [hero('A', 7)], bombs: [burningBomb(100, 0.9)] });
    const credit = feed(attributor, { heroes: [hero('A', 7)], explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(credit.unattributed.noOwnerAtBirth.damage).toBe(40);
  });

  it('forgets the roster on clear', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([fact('G', 0.1, true)]);
    attributor.clear();
    expect(feed(attributor, { heroes: [hero('G', 300)], hits: [hit(300, 42)] }).perHero.size).toBe(0);
  });
});

describe('createLiveDamageAttributor — every Unattributed reason carries damage, props and gold', () => {
  const owned = (cells: Array<[string, number]>, bombs: LiveBomb[]) => ({ heroes: cells.map(([id, cell]) => hero(id, cell)), bombs });

  it('noOwnerAtBirth: a blast of a bomb planted with nobody provable beside it', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 50)], bombs: [freshBomb(100)] });
    const credit = feed(attributor, {
      heroes: [hero('A', 50)],
      explosions: [blast(100)],
      hits: [hit(101, 40)],
      loot: [{ cell: 101, gold: 25 }],
    });
    expect(credit.unattributed.noOwnerAtBirth).toEqual({ damage: 40, props: 0, gold: 0 });
    expect(credit.unattributed.sharedOrUnattributedKill).toEqual({ damage: 0, props: 1, gold: 25 });
    expect(credit.hits.attributed).toBe(0);
  });

  it('explosionWithoutBomb: a blast that no tracked bomb explains', () => {
    const credit = feed(createLiveDamageAttributor(), {
      explosions: [blast(100)],
      hits: [hit(101, 40)],
      loot: [{ cell: 101, gold: 25 }],
    });
    expect(credit.unattributed.explosionWithoutBomb).toEqual({ damage: 40, props: 0, gold: 0 });
    expect(credit.unattributed.sharedOrUnattributedKill).toEqual({ damage: 0, props: 1, gold: 25 });
  });

  it('streamDiscontinuity: a blast after lost frames', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, owned([['A', 100]], [freshBomb(100)]));
    const credit = feed(
      attributor,
      { heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 40)], loot: [{ cell: 101, gold: 25 }] },
      true,
    );
    expect(credit.unattributed.streamDiscontinuity).toEqual({ damage: 40, props: 0, gold: 0 });
    expect(credit.unattributed.sharedOrUnattributedKill).toEqual({ damage: 0, props: 1, gold: 25 });
  });

  it('unresolvedOverlap: two crosses and a damage never seen from one hero alone', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, owned([['A', 100], ['B', 102]], [freshBomb(100, 1.6), freshBomb(102, 1.4)]));
    const credit = feed(attributor, {
      heroes: [hero('A', 100), hero('B', 102)],
      explosions: [blast(100), blast(102)],
      hits: [hit(101, 40)],
      loot: [{ cell: 101, gold: 25 }],
    });
    expect(credit.unattributed.unresolvedOverlap.damage).toBe(40);
    expect(credit.unattributed.sharedOrUnattributedKill).toEqual({ damage: 0, props: 1, gold: 25 });
  });

  it('explosionlessWithoutFantasma: a hit no blast and no Fantasma carrier explains', () => {
    const credit = feed(createLiveDamageAttributor(), { hits: [hit(300, 40)] });
    expect(credit.unattributed.explosionlessWithoutFantasma).toEqual({ damage: 40, props: 0, gold: 0 });
  });

  it('a prop on a cell only one hero hit goes to that hero with the gold', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, owned([['A', 100], ['B', 105]], [freshBomb(100, 1.6), freshBomb(105, 1.4)]));
    const credit = feed(attributor, {
      heroes: [hero('A', 100), hero('B', 105)],
      explosions: [blast(100), blast(105)],
      hits: [hit(102, 10), hit(103, 20)],
      loot: [{ cell: 102, gold: 7 }, { cell: 103, gold: 9 }],
    });
    expect(credit.perHero.get('A')).toEqual({ damage: 10, props: 1, gold: 7 });
    expect(credit.perHero.get('B')).toEqual({ damage: 20, props: 1, gold: 9 });
  });

  it('sharedOrUnattributedKill: a prop hit by two heroes on one cell goes unattributed while each keeps its damage', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, owned([['A', 100], ['B', 104]], [freshBomb(100, 1.6), freshBomb(104, 1.4)]));
    const credit = feed(attributor, {
      heroes: [hero('A', 100), hero('B', 104)],
      explosions: [blast(100), blast(104)],
      hits: [hit(98, 10), hit(106, 20), hit(102, 10), hit(102, 20)],
      loot: [{ cell: 102, gold: 7 }],
    });
    expect(credit.perHero.get('A')).toEqual({ damage: 20, props: 0, gold: 0 });
    expect(credit.perHero.get('B')).toEqual({ damage: 40, props: 0, gold: 0 });
    expect(credit.unattributed.sharedOrUnattributedKill).toEqual({ damage: 0, props: 1, gold: 7 });
    expectReconciled(credit);
  });

  it('sharedOrUnattributedKill: an unattributed hit on the loot cell takes the prop and gold', () => {
    const credit = feed(createLiveDamageAttributor(), { hits: [hit(300, 10)], loot: [{ cell: 300, gold: 7 }] });
    expect(credit.unattributed.sharedOrUnattributedKill).toEqual({ damage: 0, props: 1, gold: 7 });
    expect(credit.unattributed.explosionlessWithoutFantasma.damage).toBe(10);
  });

  it('noHitOnLootCell: loot with no hit on its cell', () => {
    const credit = feed(createLiveDamageAttributor(), { loot: [{ cell: 300, gold: 7 }] });
    expect(credit.unattributed.noHitOnLootCell).toEqual({ damage: 0, props: 1, gold: 7 });
  });
});

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

interface SimBomb {
  cell: number;
  fuseTotal: number;
  fuseRemaining: number;
}

const COLS = 19;
const CELLS = COLS * 16;
const HERO_IDS = ['H0', 'H1', 'H2', 'H3', 'H4', 'H5'];

function crossOf(cell: number, rng: () => number): number {
  const reach = 1 + Math.floor(rng() * 2);
  const arms = [cell - reach, cell + reach, cell - COLS * reach, cell + COLS * reach, cell];
  const picked = arms[Math.floor(rng() * arms.length)] ?? cell;
  return Math.min(Math.max(picked, 0), CELLS - 1);
}

function runStressStream(seed: number, frames: number) {
  const rng = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
  const attributor = createLiveDamageAttributor();
  const fuses = new Map(HERO_IDS.map((id, index) => [id, index === 5 ? 1.6 : 1.0 + index * 0.15]));
  const onField = new Map<string, number>();
  let bombs: SimBomb[] = [];
  const seen = { attributedHits: 0, unattributedHits: 0, births: 0, adopted: 0, props: 0, reasons: new Set<UnattributedReason>(), heroProps: 0 };
  const totals = { damage: 0, props: 0, gold: 0 };

  for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
    if (frameIndex === 3 || rng() < 0.01) {
      attributor.setRoster(
        rng() < 0.15
          ? []
          : HERO_IDS.map((id) => fact(id, 1 - (fuses.get(id) ?? 1) / 2 + (rng() < 0.1 ? 0.05 : 0), rng() < 0.4)),
      );
    }
    const forgetRoll = rng();
    if (forgetRoll < 0.012) attributor.clear();
    else if (forgetRoll < 0.024) attributor.forgetLiveBombs();

    for (const id of HERO_IDS) {
      if (rng() < 0.08) {
        if (onField.has(id)) onField.delete(id);
        else onField.set(id, Math.floor(rng() * CELLS));
      } else if (onField.has(id) && rng() < 0.3) {
        onField.set(id, Math.floor(rng() * CELLS));
      }
    }

    const lostFrames = rng() < 0.06 ? pick([2, 1.5]) : 1;
    const explosions: Array<{ cell: number; radius: number; secondBlast?: true }> = [];
    const survivors: SimBomb[] = [];
    for (const bomb of bombs) {
      bomb.fuseRemaining -= 0.2 * lostFrames;
      if (bomb.fuseRemaining > 0) survivors.push(bomb);
      else {
        explosions.push({ cell: bomb.cell, radius: 2 });
        if (rng() < 0.3) explosions.push({ cell: bomb.cell, radius: 2, secondBlast: true });
      }
    }
    bombs = survivors;
    for (const [id, cell] of onField) {
      if (rng() < 0.2 && !bombs.some((bomb) => bomb.cell === cell)) {
        const fuseTotal = fuses.get(id) ?? 1;
        bombs.push({ cell, fuseTotal, fuseRemaining: rng() < 0.1 ? fuseTotal * rng() + 0.2 : fuseTotal - 0.1 });
      }
    }
    if (rng() < 0.05) {
      const cell = Math.floor(rng() * CELLS);
      if (!bombs.some((bomb) => bomb.cell === cell)) bombs.push({ cell, fuseTotal: 1.6, fuseRemaining: 1.5 });
    }

    const hits: LiveHit[] = [];
    for (const explosion of explosions) {
      for (let count = Math.floor(rng() * 4); count > 0; count -= 1) {
        const critical = rng() < 0.3;
        const damage = pick([10, 20, 20, 30]);
        const base: LiveHit = { cell: crossOf(explosion.cell, rng), damage, ...(critical ? { critical } : {}) };
        hits.push(explosion.secondBlast === true ? { ...base, secondBlast: true } : base);
      }
      if (rng() < 0.15) {
        hits.push({ cell: Math.floor(rng() * CELLS), damage: 20, shardOrigin: crossOf(explosion.cell, rng) });
      }
    }
    for (const [, cell] of onField) {
      if (rng() < 0.2) hits.push({ cell, damage: pick([10, 20]) });
    }
    if (rng() < 0.05) hits.push({ cell: Math.floor(rng() * CELLS), damage: 30 });

    const loot: LiveLootPop[] = [];
    for (const entry of hits) {
      if (rng() >= 0.35) continue;
      const roll = rng();
      if (roll < 0.15) loot.push({ cell: entry.cell });
      else if (roll < 0.25) loot.push({ cell: entry.cell, gold: Number.NaN });
      else loot.push({ cell: entry.cell, gold: 1 + Math.floor(rng() * 500) });
    }
    if (rng() < 0.05) loot.push({ cell: Math.floor(rng() * CELLS), gold: 99 });

    const liveTick: LiveTick = {
      heroes: [...onField].map(([id, cell]) => ({ id, cell })),
      bombs: bombs.map((bomb) => ({
        cell: bomb.cell,
        radius: 2,
        fuseRemainingSeconds: bomb.fuseRemaining,
        fuseTotalSeconds: bomb.fuseTotal,
      })),
      explosions,
      hits,
      loot,
    };
    const credit = attributor.consume(liveTick, { discontinuous: rng() < 0.05 });

    const oracle = {
      damage: hits.reduce((sum, entry) => sum + entry.damage, 0),
      props: loot.filter((pop) => pop.gold !== undefined && Number.isFinite(pop.gold)).length,
      gold: loot.reduce((sum, pop) => sum + (pop.gold !== undefined && Number.isFinite(pop.gold) ? pop.gold : 0), 0),
    };
    expect(credit.team).toEqual(oracle);
    expectReconciled(credit);
    expect(credit.hits.total).toBe(hits.length);

    totals.damage += credit.team.damage;
    totals.props += credit.team.props;
    totals.gold += credit.team.gold;
    seen.attributedHits += credit.hits.attributed;
    seen.unattributedHits += credit.hits.total - credit.hits.attributed;
    seen.births += credit.bombs.births;
    seen.adopted += credit.bombs.adopted;
    for (const amounts of credit.perHero.values()) seen.heroProps += amounts.props;
    for (const reason of ALL_REASONS) {
      const amounts = credit.unattributed[reason];
      if (amounts.damage > 0 || amounts.props > 0) seen.reasons.add(reason);
    }
  }
  return { seen, totals };
}

describe('createLiveDamageAttributor — reconciliation on a seeded stress stream', () => {
  it.each([1, 2, 3])('reconciles team, per-hero and Unattributed exactly after every frame (seed %i)', (seed) => {
    const { seen, totals } = runStressStream(seed, 2400);
    expect(totals.damage).toBeGreaterThan(0);
    expect(totals.props).toBeGreaterThan(0);
    expect(totals.gold).toBeGreaterThan(0);
    expect(seen.attributedHits).toBeGreaterThan(0);
    expect(seen.unattributedHits).toBeGreaterThan(0);
    expect(seen.births).toBeGreaterThan(0);
    expect(seen.adopted).toBeGreaterThan(0);
    expect(seen.heroProps).toBeGreaterThan(0);
  });

  it('exercises overlaps, ghosts, discontinuities, shared kills and loot without a hit', () => {
    const reasons = new Set<UnattributedReason>();
    for (const seed of [1, 2, 3]) for (const reason of runStressStream(seed, 2400).seen.reasons) reasons.add(reason);
    expect([...reasons].sort()).toEqual([...ALL_REASONS].sort());
  });
});

describe('createLiveDamageAttributor — edges the engine must keep', () => {
  it('forgets a burning owned bomb on clear, so its blast has no tracked bomb rather than the old owner', () => {
    const attributor = createLiveDamageAttributor();
    feed(attributor, { heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    attributor.clear();
    const credit = feed(attributor, { heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(credit.perHero.size).toBe(0);
    expect(credit.unattributed.explosionWithoutBomb.damage).toBe(40);
  });

  it('bounds a blast by the grid height the tick reports through its kinds array', () => {
    const attributor = createLiveDamageAttributor();
    const kinds = new Array<number>(19 * 17).fill(-1);
    const planted = 15 * 19 + 3;
    const onLastRow = 16 * 19 + 3;
    feed(attributor, { heroes: [hero('A', planted)], bombs: [freshBomb(planted)], kinds });
    const credit = feed(attributor, {
      heroes: [hero('A', planted)],
      explosions: [blast(planted)],
      hits: [hit(onLastRow, 40)],
      kinds,
    });
    expect(credit.perHero.get('A')?.damage).toBe(40);
  });

  it('counts an empty roster as unknown, so a hero on a cross-covered plain-hit cell makes the hit unattributed', () => {
    const attributor = createLiveDamageAttributor();
    attributor.setRoster([]);
    const heroes = [hero('A', 100), hero('B', 101)];
    feed(attributor, { heroes, bombs: [freshBomb(100)] });
    const credit = feed(attributor, { heroes, explosions: [blast(100)], hits: [hit(101, 40)] });
    expect(credit.perHero.size).toBe(0);
    expect(credit.unattributed.unresolvedOverlap.damage).toBe(40);
  });
});
