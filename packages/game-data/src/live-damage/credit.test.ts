import { describe, expect, it } from 'vitest';
import type { LiveExplosion, LiveHit, LiveTickHero, UnattributedReason } from '@bombfarm/contracts';
import type { LedgerStep, RetiredBomb } from './bomb-ledger.js';
import { creditHits, creditLoot, createSignatureBook, type CreditHitsInput, type HitCredit } from './credit.js';

const retired = (owner: string | null, radius = 2, reason?: UnattributedReason): RetiredBomb =>
  reason === undefined ? { owner, radius } : { owner, radius, reason };

function ledgerStep(
  thisFrame: Record<number, RetiredBomb> = {},
  options: { lastFrame?: Record<number, RetiredBomb>; discontinuous?: boolean } = {},
): LedgerStep {
  return {
    discontinuous: options.discontinuous ?? false,
    births: 0,
    adopted: 0,
    owned: 0,
    cellOwnerConflicts: 0,
    retiredThisFrame: new Map(Object.entries(thisFrame).map(([cell, bomb]) => [Number(cell), bomb])),
    retiredLastFrame: new Map(Object.entries(options.lastFrame ?? {}).map(([cell, bomb]) => [Number(cell), bomb])),
    disagreements: [],
  };
}

const blast = (cell: number, radius = 2): LiveExplosion => ({ cell, radius });
const secondBlast = (cell: number, radius = 2): LiveExplosion => ({ cell, radius, secondBlast: true });
const hit = (cell: number, damage = 50, extra: Partial<LiveHit> = {}): LiveHit => ({ cell, damage, ...extra });
const hero = (id: string, cell?: number): LiveTickHero => (cell === undefined ? { id } : { id, cell });

function run(overrides: Partial<CreditHitsInput> & { hits: LiveHit[] }): HitCredit[] {
  return creditHits({
    explosions: [],
    ledger: ledgerStep(),
    heroes: [],
    fantasma: new Set<string>(),
    rows: 16,
    signatures: createSignatureBook(),
    ...overrides,
  });
}

const outcome = (credit: HitCredit | undefined) => (credit === undefined ? undefined : credit.credited ?? credit.reason);

describe('creditHits — a single owned cross', () => {
  it('credits a hit on the cross of one owned explosion to its owner', () => {
    const [credit] = run({ hits: [hit(101)], explosions: [blast(100)], ledger: ledgerStep({ 100: retired('A') }) });
    expect(credit).toEqual({ cell: 101, damage: 50, credited: 'A', reason: null });
  });

  it('records the damage signature of a hit credited through a single cross', () => {
    const signatures = createSignatureBook();
    run({ hits: [hit(101, 77, { critical: true })], explosions: [blast(100)], ledger: ledgerStep({ 100: retired('A') }), signatures });
    expect(signatures.decisive(77, true, ['A', 'B'])).toBe('A');
  });

  it('does not credit a hit that lies outside every cross', () => {
    const [credit] = run({ hits: [hit(60)], explosions: [blast(100)], ledger: ledgerStep({ 100: retired('A') }) });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });

  it('uses the row count it is given to bound the cross', () => {
    const lowerRow = 10 * 19 + 3;
    const explosionOnLastRow = blast(9 * 19 + 3);
    const ledger = ledgerStep({ [9 * 19 + 3]: retired('A') });
    expect(outcome(run({ hits: [hit(lowerRow)], explosions: [explosionOnLastRow], ledger, rows: 10 })[0])).toBe('explosionlessWithoutFantasma');
    expect(outcome(run({ hits: [hit(lowerRow)], explosions: [explosionOnLastRow], ledger, rows: 16 })[0])).toBe('A');
  });

  it('credits a hit covered by two explosions of the same owner without recording a signature', () => {
    const signatures = createSignatureBook();
    const [credit] = run({
      hits: [hit(101, 61)],
      explosions: [blast(100), blast(102)],
      ledger: ledgerStep({ 100: retired('A'), 102: retired('A') }),
      signatures,
    });
    expect(outcome(credit)).toBe('A');
    expect(signatures.decisive(61, false, ['A'])).toBeNull();
  });

  it('reads the critical flag as part of the signature key', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'A');
    const explosions = [blast(100), blast(102)];
    const ledger = ledgerStep({ 100: retired('A'), 102: retired('B') });
    expect(outcome(run({ hits: [hit(101, 50)], explosions, ledger, signatures })[0])).toBe('A');
    expect(outcome(run({ hits: [hit(101, 50, { critical: true })], explosions, ledger, signatures })[0])).toBe('unresolvedOverlap');
  });
});

describe('creditHits — overlapping crosses', () => {
  const overlap = { explosions: [blast(100), blast(102)], ledger: ledgerStep({ 100: retired('A'), 102: retired('B') }) };

  it('credits an overlap to the one candidate its damage signature is decisive for, and records nothing', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'A');
    const [credit] = run({ hits: [hit(101)], ...overlap, signatures });
    expect(outcome(credit)).toBe('A');
    expect(signatures.decisive(50, false, ['A', 'B'])).toBe('A');
  });

  it('leaves an overlap unattributed when its damage signature was seen from two heroes', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'A');
    signatures.record(50, false, 'B');
    expect(outcome(run({ hits: [hit(101)], ...overlap, signatures })[0])).toBe('unresolvedOverlap');
  });

  it('leaves an overlap unattributed when the one hero with that signature is not a candidate', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'Z');
    expect(outcome(run({ hits: [hit(101)], ...overlap, signatures })[0])).toBe('unresolvedOverlap');
  });

  it('leaves an overlap unattributed when its damage was never seen', () => {
    expect(outcome(run({ hits: [hit(101)], ...overlap })[0])).toBe('unresolvedOverlap');
  });

  it('leaves an overlap that includes an unowned explosion unattributed even with a decisive signature', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'A');
    const [credit] = run({
      hits: [hit(101)],
      explosions: [blast(100), blast(102)],
      ledger: ledgerStep({ 100: retired('A'), 102: retired(null, 2, 'noOwnerAtBirth') }),
      signatures,
    });
    expect(outcome(credit)).toBe('unresolvedOverlap');
  });
});

describe('creditHits — a single unowned cross', () => {
  it('names a stream discontinuity when the frame was discontinuous', () => {
    const [credit] = run({ hits: [hit(101)], explosions: [blast(100)], ledger: ledgerStep({ 100: retired('A') }, { discontinuous: true }) });
    expect(outcome(credit)).toBe('streamDiscontinuity');
  });

  it('names an explosion without a tracked bomb when no bomb retired at its cell', () => {
    const [credit] = run({ hits: [hit(101)], explosions: [blast(100)], ledger: ledgerStep() });
    expect(outcome(credit)).toBe('explosionWithoutBomb');
  });

  it('names an explosion without a tracked bomb when the retired bomb had another radius', () => {
    const [credit] = run({ hits: [hit(101)], explosions: [blast(100, 2)], ledger: ledgerStep({ 100: retired('A', 3) }) });
    expect(outcome(credit)).toBe('explosionWithoutBomb');
  });

  it('names no owner at birth when the retired bomb was never owned', () => {
    const [credit] = run({ hits: [hit(101)], explosions: [blast(100)], ledger: ledgerStep({ 100: retired(null, 2, 'noOwnerAtBirth') }) });
    expect(outcome(credit)).toBe('noOwnerAtBirth');
  });

  it('carries the discontinuity reason of a carried bomb that lost its owner', () => {
    const [credit] = run({ hits: [hit(101)], explosions: [blast(100)], ledger: ledgerStep({ 100: retired(null, 2, 'streamDiscontinuity') }) });
    expect(outcome(credit)).toBe('streamDiscontinuity');
  });

  it('does not use the previous frame retirements for an ordinary explosion', () => {
    const [credit] = run({ hits: [hit(101)], explosions: [blast(100)], ledger: ledgerStep({}, { lastFrame: { 100: retired('A') } }) });
    expect(outcome(credit)).toBe('explosionWithoutBomb');
  });
});

describe('creditHits — second blasts', () => {
  it('credits a second-blast hit through the second-blast cross, not the ordinary one that shares its cell', () => {
    const [credit] = run({
      hits: [hit(101, 50, { secondBlast: true })],
      explosions: [blast(100), secondBlast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
    });
    expect(outcome(credit)).toBe('A');
  });

  it('does not let a second-blast twin make an ordinary hit an overlap', () => {
    const [credit] = run({
      hits: [hit(101)],
      explosions: [blast(100), secondBlast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
    });
    expect(outcome(credit)).toBe('A');
  });

  it('does not let an ordinary cross of another hero make a second-blast hit an overlap', () => {
    const [credit] = run({
      hits: [hit(101, 50, { secondBlast: true })],
      explosions: [blast(102), secondBlast(100)],
      ledger: ledgerStep({ 100: retired('A'), 102: retired('B') }),
    });
    expect(outcome(credit)).toBe('A');
  });

  it('takes a second-blast owner from the previous frame retirements when this frame has none', () => {
    const [credit] = run({
      hits: [hit(101, 50, { secondBlast: true })],
      explosions: [secondBlast(100)],
      ledger: ledgerStep({}, { lastFrame: { 100: retired('A') } }),
    });
    expect(outcome(credit)).toBe('A');
  });

  it('prefers this frame retirement over the previous frame one for a second blast', () => {
    const [credit] = run({
      hits: [hit(101, 50, { secondBlast: true })],
      explosions: [secondBlast(100)],
      ledger: ledgerStep({ 100: retired('NEW') }, { lastFrame: { 100: retired('OLD') } }),
    });
    expect(outcome(credit)).toBe('NEW');
  });

  it('names an explosion without a tracked bomb when the previous frame retirement has another radius', () => {
    const [credit] = run({
      hits: [hit(101, 50, { secondBlast: true })],
      explosions: [secondBlast(100, 2)],
      ledger: ledgerStep({}, { lastFrame: { 100: retired('A', 4) } }),
    });
    expect(outcome(credit)).toBe('explosionWithoutBomb');
  });

  it('leaves a second-blast hit that no second-blast cross covers unattributed, though an ordinary one does', () => {
    const [credit] = run({
      hits: [hit(101, 50, { secondBlast: true })],
      explosions: [blast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
    });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });

  it('does not record a signature from a second-blast hit', () => {
    const signatures = createSignatureBook();
    run({
      hits: [hit(101, 88, { secondBlast: true })],
      explosions: [secondBlast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
      signatures,
    });
    expect(signatures.decisive(88, false, ['A'])).toBeNull();
  });

  it('marks every second-blast explosion unowned on a discontinuous frame', () => {
    const [credit] = run({
      hits: [hit(101, 50, { secondBlast: true })],
      explosions: [secondBlast(100)],
      ledger: ledgerStep({}, { lastFrame: { 100: retired('A') }, discontinuous: true }),
    });
    expect(outcome(credit)).toBe('streamDiscontinuity');
  });
});

describe('creditHits — shard hits', () => {
  it('credits a shard hit through the cross covering its origin cell, not its landing cell', () => {
    const [credit] = run({
      hits: [hit(300, 50, { shardOrigin: 101 })],
      explosions: [blast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
    });
    expect(credit).toEqual({ cell: 300, damage: 50, credited: 'A', reason: null });
  });

  it('leaves a shard hit whose origin no cross covers unattributed, even beside a Fantasma carrier', () => {
    const [credit] = run({
      hits: [hit(300, 50, { shardOrigin: 250 })],
      explosions: [blast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
      heroes: [hero('G', 300)],
      fantasma: new Set(['G']),
    });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });

  it('ignores a cross that covers only the landing cell of a shard hit', () => {
    const [credit] = run({
      hits: [hit(101, 50, { shardOrigin: 250 })],
      explosions: [blast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
    });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });
});

describe('creditHits — hits no cross explains', () => {
  it('credits a plain hit to the lone Fantasma carrier standing on its cell and records no signature', () => {
    const signatures = createSignatureBook();
    const [credit] = run({ hits: [hit(300, 42)], heroes: [hero('G', 300)], fantasma: new Set(['G']), signatures });
    expect(credit).toEqual({ cell: 300, damage: 42, credited: 'G', reason: null });
    expect(signatures.decisive(42, false, ['G'])).toBeNull();
  });

  it('leaves a plain hit beside a hero without Fantasma unattributed', () => {
    const [credit] = run({ hits: [hit(300)], heroes: [hero('H', 300)], fantasma: new Set(['G']) });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });

  it('leaves a plain hit unattributed when no hero stands on its cell', () => {
    const [credit] = run({ hits: [hit(300)], heroes: [hero('G', 12)], fantasma: new Set(['G']) });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });

  it('leaves a plain hit unattributed when the roster is unknown', () => {
    const [credit] = run({ hits: [hit(300)], heroes: [hero('G', 300)], fantasma: null });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });

  it('treats two Fantasma carriers on one cell as an overlap that nothing resolves', () => {
    const [credit] = run({ hits: [hit(300)], heroes: [hero('G1', 300), hero('G2', 300)], fantasma: new Set(['G1', 'G2']) });
    expect(outcome(credit)).toBe('unresolvedOverlap');
  });

  it('ignores a hero whose cell the wire omitted', () => {
    const [credit] = run({ hits: [hit(300)], heroes: [hero('G')], fantasma: new Set(['G']) });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });

  it('never reaches the ghost rule with a second-blast hit', () => {
    const [credit] = run({
      hits: [hit(300, 50, { secondBlast: true })],
      heroes: [hero('G', 300)],
      fantasma: new Set(['G']),
    });
    expect(outcome(credit)).toBe('explosionlessWithoutFantasma');
  });
});

describe('creditHits — a Fantasma carrier on a cell a cross also covers', () => {
  const setup = {
    hits: [hit(101)],
    explosions: [blast(100)],
    ledger: ledgerStep({ 100: retired('A') }),
    heroes: [hero('G', 101)],
    fantasma: new Set(['G']),
  };

  it('is an overlap that stays unattributed when no signature decides it', () => {
    expect(outcome(run(setup)[0])).toBe('unresolvedOverlap');
  });

  it('resolves to the cross owner when the damage signature belongs to it alone', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'A');
    expect(outcome(run({ ...setup, signatures })[0])).toBe('A');
  });

  it('resolves to the carrier when the damage signature belongs to it alone', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'G');
    expect(outcome(run({ ...setup, signatures })[0])).toBe('G');
  });

  it('is not an overlap when the carrier is also the cross owner', () => {
    expect(outcome(run({ ...setup, ledger: ledgerStep({ 100: retired('G') }) })[0])).toBe('G');
  });

  it('is unattributed while the roster is unknown and any hero stands on the covered cell, even a decisive signature', () => {
    const signatures = createSignatureBook();
    signatures.record(50, false, 'A');
    const [credit] = run({ ...setup, fantasma: null, signatures });
    expect(outcome(credit)).toBe('unresolvedOverlap');
  });

  it('is credited to the cross owner while the roster is unknown and no hero stands on the cell', () => {
    expect(outcome(run({ ...setup, fantasma: null, heroes: [] })[0])).toBe('A');
  });
});

describe('creditHits — whole frames', () => {
  it('returns one credit per hit, in order, each carrying its landing cell and damage', () => {
    const credits = run({
      hits: [hit(101, 10), hit(300, 20), hit(98, 30)],
      explosions: [blast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
    });
    expect(credits.map((credit) => [credit.cell, credit.damage, outcome(credit)])).toEqual([
      [101, 10, 'A'],
      [300, 20, 'explosionlessWithoutFantasma'],
      [98, 30, 'A'],
    ]);
  });

  it('returns nothing for a frame without hits', () => {
    expect(run({ hits: [], explosions: [blast(100)], ledger: ledgerStep({ 100: retired('A') }) })).toEqual([]);
  });
});

describe('signature book', () => {
  it('is decisive only for a key with exactly one producer', () => {
    const book = createSignatureBook();
    book.record(10, false, 'A');
    expect(book.decisive(10, false, ['A', 'B'])).toBe('A');
    book.record(10, false, 'B');
    expect(book.decisive(10, false, ['A', 'B'])).toBeNull();
  });

  it('is not decisive when its one producer is not among the candidates', () => {
    const book = createSignatureBook();
    book.record(10, false, 'A');
    expect(book.decisive(10, false, ['B', 'C'])).toBeNull();
  });

  it('keeps the same damage with and without a critical flag apart', () => {
    const book = createSignatureBook();
    book.record(10, true, 'A');
    expect(book.decisive(10, false, ['A'])).toBeNull();
    expect(book.decisive(10, true, ['A'])).toBe('A');
  });

  it('is not decisive for a key it has never seen', () => {
    expect(createSignatureBook().decisive(10, false, ['A'])).toBeNull();
  });

  it('forgets everything on clear', () => {
    const book = createSignatureBook();
    book.record(10, false, 'A');
    book.clear();
    expect(book.decisive(10, false, ['A'])).toBeNull();
  });
});

describe('creditLoot', () => {
  const credited = (cell: number, heroId: string | null, damage = 10): HitCredit => ({
    cell,
    damage,
    credited: heroId,
    reason: heroId === null ? 'unresolvedOverlap' : null,
  });

  it('gives the prop and its gold to the hero every hit on the cell was credited to', () => {
    expect(creditLoot([{ cell: 7, gold: 120 }], [credited(7, 'A'), credited(7, 'A', 30)])).toEqual([
      { gold: 120, credited: 'A', reason: null },
    ]);
  });

  it('sends a kill shared by two heroes to the shared-kill reason', () => {
    expect(creditLoot([{ cell: 7, gold: 120 }], [credited(7, 'A'), credited(7, 'B')])).toEqual([
      { gold: 120, credited: null, reason: 'sharedOrUnattributedKill' },
    ]);
  });

  it('sends a kill with any unattributed hit on its cell to the shared-kill reason', () => {
    expect(creditLoot([{ cell: 7, gold: 120 }], [credited(7, 'A'), credited(7, null)])).toEqual([
      { gold: 120, credited: null, reason: 'sharedOrUnattributedKill' },
    ]);
    expect(creditLoot([{ cell: 7, gold: 120 }], [credited(7, null)])).toEqual([
      { gold: 120, credited: null, reason: 'sharedOrUnattributedKill' },
    ]);
  });

  it('sends a loot entry with no hit on its cell to the no-hit reason', () => {
    expect(creditLoot([{ cell: 7, gold: 120 }], [credited(8, 'A')])).toEqual([
      { gold: 120, credited: null, reason: 'noHitOnLootCell' },
    ]);
    expect(creditLoot([{ cell: 7, gold: 120 }], [])).toEqual([{ gold: 120, credited: null, reason: 'noHitOnLootCell' }]);
  });

  it('skips an entry with no gold, with non-finite gold, entirely', () => {
    const loot = [{ cell: 7 }, { cell: 7, gold: Number.NaN }, { cell: 7, gold: Number.POSITIVE_INFINITY }, { cell: 7, gold: 5 }];
    expect(creditLoot(loot, [credited(7, 'A')])).toEqual([{ gold: 5, credited: 'A', reason: null }]);
  });

  it('returns nothing for a frame without loot', () => {
    expect(creditLoot([], [credited(7, 'A')])).toEqual([]);
  });

  it('matches loot to the hit landing cell, not the shard origin cell', () => {
    const hits = run({
      hits: [hit(300, 50, { shardOrigin: 101 })],
      explosions: [blast(100)],
      ledger: ledgerStep({ 100: retired('A') }),
    });
    expect(creditLoot([{ cell: 101, gold: 9 }], hits)).toEqual([{ gold: 9, credited: null, reason: 'noHitOnLootCell' }]);
    expect(creditLoot([{ cell: 300, gold: 9 }], hits)).toEqual([{ gold: 9, credited: 'A', reason: null }]);
  });

  it('keeps each hit damage with whoever it was credited to', () => {
    const hits = [credited(7, 'A', 10), credited(7, 'B', 20)];
    creditLoot([{ cell: 7, gold: 1 }], hits);
    expect(hits.map((entry) => [entry.credited, entry.damage])).toEqual([
      ['A', 10],
      ['B', 20],
    ]);
  });

  it('credits each loot entry on its own cell, in order, carrying its own gold', () => {
    const credits = creditLoot(
      [
        { cell: 7, gold: 100 },
        { cell: 9, gold: 250 },
        { cell: 11, gold: 40 },
      ],
      [credited(7, 'A'), credited(9, 'B')],
    );
    expect(credits).toEqual([
      { gold: 100, credited: 'A', reason: null },
      { gold: 250, credited: 'B', reason: null },
      { gold: 40, credited: null, reason: 'noHitOnLootCell' },
    ]);
  });
});
