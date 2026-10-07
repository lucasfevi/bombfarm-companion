import { describe, expect, it } from 'vitest';
import type { LiveBomb, LiveTickHero } from '@bombfarm/contracts';
import { createBombLedger, type LedgerStep } from './bomb-ledger.js';
import { createFingerprintBook } from './fingerprints.js';

const FUSE = 1.6;
const FRAME = 0.2;

const bomb = (cell: number, fuseRemainingSeconds: number, fuseTotalSeconds = FUSE, radius = 2): LiveBomb => ({
  cell,
  radius,
  fuseRemainingSeconds,
  fuseTotalSeconds,
});
const freshBomb = (cell: number, fuseTotalSeconds = FUSE, radius = 2) =>
  bomb(cell, fuseTotalSeconds - 0.1, fuseTotalSeconds, radius);
const hero = (id: string, cell?: number): LiveTickHero => (cell === undefined ? { id } : { id, cell });

function setup() {
  const book = createFingerprintBook();
  const ledger = createBombLedger(book);
  const advance = (bombs: LiveBomb[], heroes: LiveTickHero[] = [], discontinuous = false): LedgerStep =>
    ledger.advance({ bombs, heroes, discontinuous });
  const leave = () => advance([]);
  return { book, ledger, advance, leave };
}

describe('bomb ledger — continuity', () => {
  it('treats a carried bomb whose fuse fell by one frame as continuous', () => {
    const { advance } = setup();
    advance([bomb(5, 1.5)]);
    expect(advance([bomb(5, 1.5 - FRAME)]).discontinuous).toBe(false);
  });

  it('tolerates 0.01 s of timing noise on the fuse step and no more', () => {
    const noisy = setup();
    noisy.advance([bomb(5, 1.5)]);
    expect(noisy.advance([bomb(5, 1.5 - 0.209)]).discontinuous).toBe(false);

    const broken = setup();
    broken.advance([bomb(5, 1.5)]);
    expect(broken.advance([bomb(5, 1.5 - 0.211)]).discontinuous).toBe(true);
  });

  it('flags a carried bomb whose fuse fell by two frames as discontinuous', () => {
    const { advance } = setup();
    advance([bomb(5, 1.5)]);
    expect(advance([bomb(5, 1.5 - 2 * FRAME)]).discontinuous).toBe(true);
  });

  it('passes the input discontinuity flag through even when every fuse step is clean', () => {
    const { advance } = setup();
    advance([bomb(5, 1.5)]);
    expect(advance([bomb(5, 1.5 - FRAME)], [], true).discontinuous).toBe(true);
  });

  it('is continuous on a frame with no carried bombs', () => {
    const { advance } = setup();
    expect(advance([freshBomb(5)]).discontinuous).toBe(false);
    expect(advance([]).discontinuous).toBe(false);
  });
});

describe('bomb ledger — what makes a bomb new', () => {
  it('treats a bomb on a cell that held none as new', () => {
    const { advance } = setup();
    const step = advance([freshBomb(5)]);
    expect(step.births).toBe(1);
    expect(step.retiredThisFrame.size).toBe(0);
  });

  it('does not treat a carried bomb as new', () => {
    const { advance } = setup();
    advance([freshBomb(5)]);
    const step = advance([bomb(5, FUSE - 0.1 - FRAME)]);
    expect(step.births + step.adopted).toBe(0);
    expect(step.retiredThisFrame.size).toBe(0);
  });

  it('retires the old bomb and births a new one when the fuse total changes at the cell', () => {
    const { book, advance } = setup();
    book.seed('a', 1.6);
    book.seed('b', 1.2);
    advance([freshBomb(5, 1.6)], [hero('a', 5)]);
    const step = advance([freshBomb(5, 1.2)], [hero('b', 5)]);
    expect(step.births).toBe(1);
    expect(step.retiredThisFrame.get(5)).toEqual({ owner: 'a', radius: 2 });
  });

  it('treats a rise in remaining fuse as a new bomb and retires the old one', () => {
    const { advance } = setup();
    advance([bomb(5, 0.6)], [hero('a', 5)]);
    const step = advance([bomb(5, FUSE - 0.05)], [hero('a', 5)]);
    expect(step.births).toBe(1);
    expect(step.retiredThisFrame.has(5)).toBe(true);
  });
});

describe('bomb ledger — fresh Birth versus adopted', () => {
  it('counts a bomb first seen within one frame of game time as a Birth', () => {
    const { advance } = setup();
    const step = advance([bomb(5, FUSE - FRAME)]);
    expect(step.births).toBe(1);
    expect(step.adopted).toBe(0);
  });

  it('counts a bomb first seen older than one frame as adopted', () => {
    const { advance } = setup();
    const step = advance([bomb(5, FUSE - 0.25), bomb(6, 0.4)]);
    expect(step.births).toBe(0);
    expect(step.adopted).toBe(2);
  });

  it('adopts every already-burning bomb on the very first frame, with no first-frame exclusion for a fresh one', () => {
    const { advance } = setup();
    const step = advance([bomb(5, 0.4), freshBomb(6)]);
    expect(step.adopted).toBe(1);
    expect(step.births).toBe(1);
  });
});

describe('bomb ledger — owner cascade', () => {
  it('owns a Birth by its unique fingerprint even when another hero stands on the cell', () => {
    const { book, advance, leave } = setup();
    book.seed('a', FUSE);
    advance([freshBomb(5)], [hero('a', 9), hero('b', 5)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('owns a Birth with a shared fingerprint by the one hero standing on its cell', () => {
    const { book, advance, leave } = setup();
    book.seed('a', FUSE);
    book.seed('b', FUSE);
    advance([freshBomb(5)], [hero('a', 9), hero('b', 5)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('b');
  });

  it('leaves a Birth with a shared fingerprint and two heroes on its cell without an owner', () => {
    const { book, advance, leave } = setup();
    book.seed('a', FUSE);
    book.seed('b', FUSE);
    const step = advance([freshBomb(5)], [hero('a', 5), hero('b', 5)]);
    expect(step.owned).toBe(0);
    expect(leave().retiredThisFrame.get(5)).toEqual({ owner: null, radius: 2, reason: 'noOwnerAtBirth' });
  });

  it('leaves a Birth with an unknown fingerprint and nobody on its cell without an owner', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 9)]);
    expect(leave().retiredThisFrame.get(5)).toEqual({ owner: null, radius: 2, reason: 'noOwnerAtBirth' });
  });

  it('owns a Birth with an unknown fingerprint by the one hero on its cell', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5), hero('b', 9)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('ignores a fingerprint whose hero is not in the frame', () => {
    const { book, advance, leave } = setup();
    book.seed('away', FUSE);
    advance([freshBomb(5)], [hero('b', 5)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('b');
  });

  it('counts only owned Births in owned', () => {
    const { book, advance } = setup();
    book.seed('a', 1.6);
    const step = advance([freshBomb(5, 1.6), freshBomb(7, 1.1)], [hero('a', 3)]);
    expect(step.births).toBe(2);
    expect(step.owned).toBe(1);
  });
});

describe('bomb ledger — adopted bombs', () => {
  it('owns an adopted bomb by a unique fingerprint', () => {
    const { book, advance, leave } = setup();
    book.seed('a', FUSE);
    advance([bomb(5, 0.8)], [hero('a', 9)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('never owns an adopted bomb by the hero standing on its cell', () => {
    const { advance, leave } = setup();
    advance([bomb(5, 0.8)], [hero('a', 5)]);
    expect(leave().retiredThisFrame.get(5)).toEqual({ owner: null, radius: 2, reason: 'noOwnerAtBirth' });
  });

  it('never teaches the fingerprint book from an adopted bomb', () => {
    const { book, advance } = setup();
    advance([bomb(5, 0.8)], [hero('a', 5)]);
    expect(book.resolve(FUSE, new Set(['a']))).toEqual({ kind: 'unknown' });
  });
});

describe('bomb ledger — teaching the fingerprint book', () => {
  it('teaches a fresh Birth on a continuous frame with exactly one hero on the cell', () => {
    const { book, advance } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    expect(book.resolve(FUSE, new Set(['a']))).toEqual({ kind: 'unique', heroId: 'a' });
  });

  it('does not teach when two heroes stand on the cell', () => {
    const { book, advance } = setup();
    advance([freshBomb(5)], [hero('a', 5), hero('b', 5)]);
    expect(book.resolve(FUSE, new Set(['a', 'b']))).toEqual({ kind: 'unknown' });
  });

  it('does not teach on a discontinuous frame, though the cell hero still owns the Birth', () => {
    const { book, advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5)], true);
    expect(book.resolve(FUSE, new Set(['a']))).toEqual({ kind: 'unknown' });
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('teaches nothing and counts a conflict when the fingerprint names a different hero than the cell', () => {
    const { book, advance, leave } = setup();
    book.seed('a', FUSE);
    const step = advance([freshBomb(5)], [hero('a', 9), hero('b', 5)]);
    expect(step.cellOwnerConflicts).toBe(1);
    expect(book.resolve(FUSE, new Set(['b']))).toEqual({ kind: 'unknown' });
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('counts no conflict when the fingerprint and the cell agree', () => {
    const { book, advance } = setup();
    book.seed('a', FUSE);
    expect(advance([freshBomb(5)], [hero('a', 5)]).cellOwnerConflicts).toBe(0);
  });

  it('marks a fuse total shared once two heroes have been taught it', () => {
    const { book, advance } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    advance([freshBomb(7)], [hero('b', 7)]);
    expect(book.resolve(FUSE, new Set(['a', 'b']))).toEqual({ kind: 'shared' });
  });

  it('surfaces a disagreement between a seed and the fuse it learned', () => {
    const { book, advance } = setup();
    book.seed('a', 1.9);
    const step = advance([freshBomb(5)], [hero('a', 5)]);
    expect(step.disagreements).toEqual([{ heroId: 'a', seeded: 1.9, learned: FUSE }]);
    expect(advance([freshBomb(7)], [hero('a', 7)]).disagreements).toEqual([]);
  });
});

describe('bomb ledger — owner kept for the life of the bomb', () => {
  it('keeps the owner when the hero walks off the cell', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    advance([bomb(5, FUSE - 0.1 - FRAME)], [hero('a', 12)]);
    advance([bomb(5, FUSE - 0.1 - 2 * FRAME)], [hero('b', 5)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('keeps the owner when the hero leaves the field while the bomb still burns', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    advance([bomb(5, FUSE - 0.1 - FRAME)], []);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('keeps the owner across a wave rollover that replaces the whole hero list while the bomb stays', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5), hero('b', 8)]);
    advance([bomb(5, FUSE - 0.1 - FRAME)], [hero('c', 1), hero('d', 2)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });
});

describe('bomb ledger — retirement', () => {
  it('retires a bomb that leaves the frame with its owner and radius', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5, FUSE, 3)], [hero('a', 5)]);
    expect(leave().retiredThisFrame.get(5)).toEqual({ owner: 'a', radius: 3 });
  });

  it('keeps a retired bomb in retiredLastFrame for exactly one more frame', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    const leaving = leave();
    expect(leaving.retiredLastFrame.size).toBe(0);
    const following = advance([]);
    expect(following.retiredThisFrame.size).toBe(0);
    expect(following.retiredLastFrame.get(5)).toEqual({ owner: 'a', radius: 2 });
    expect(advance([]).retiredLastFrame.size).toBe(0);
  });

  it('keeps the bomb replaced by a Birth in retiredLastFrame on the next frame', () => {
    const { advance } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    advance([freshBomb(5, 1.2)], [hero('b', 5)]);
    expect(advance([bomb(5, 0.9, 1.2)]).retiredLastFrame.get(5)).toEqual({ owner: 'a', radius: 2 });
  });

  it('records the reason when the retired bomb had no owner', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], []);
    expect(leave().retiredThisFrame.get(5)?.reason).toBe('noOwnerAtBirth');
  });

  it('forgets every live bomb on clear, so the same bomb is new again and nothing is retired', () => {
    const { ledger, advance } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    ledger.clear();
    const step = advance([bomb(5, FUSE - 0.1 - FRAME)], [hero('a', 5)]);
    expect(step.adopted).toBe(1);
    expect(step.retiredThisFrame.size).toBe(0);
    expect(step.retiredLastFrame.size).toBe(0);
  });

  it('also forgets bombs retired the frame before on clear', () => {
    const { ledger, advance } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    advance([]);
    ledger.clear();
    expect(advance([]).retiredLastFrame.size).toBe(0);
  });
});

describe('bomb ledger — discontinuous frames', () => {
  it('keeps a carried bomb owner when its fuse fell by a whole number of frames', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    advance([bomb(5, FUSE - 0.1 - 2 * FRAME)], [hero('a', 5)]);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('drops a carried bomb owner when its fuse fell by a fraction of a frame', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    const step = advance([bomb(5, FUSE - 0.1 - 0.3)], [hero('a', 5)]);
    expect(step.discontinuous).toBe(true);
    expect(leave().retiredThisFrame.get(5)).toEqual({ owner: null, radius: 2, reason: 'streamDiscontinuity' });
  });

  it('keeps an owner on a frame flagged discontinuous by the input alone when the step was clean', () => {
    const { advance, leave } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    advance([bomb(5, FUSE - 0.1 - FRAME)], [hero('a', 5)], true);
    expect(leave().retiredThisFrame.get(5)?.owner).toBe('a');
  });

  it('hands a bomb retired on a discontinuous frame to the next frame unowned', () => {
    const { advance } = setup();
    advance([freshBomb(5)], [hero('a', 5)]);
    const lost = advance([], [], true);
    expect(lost.retiredThisFrame.get(5)?.owner).toBe('a');
    expect(advance([]).retiredLastFrame.get(5)).toEqual({ owner: null, radius: 2, reason: 'streamDiscontinuity' });
  });
});

describe('bomb ledger — the fresh-age edge', () => {
  it('counts a bomb 0.209 s into its fuse as a Birth', () => {
    const { advance } = setup();
    const step = advance([bomb(5, FUSE - 0.209)]);
    expect(step.births).toBe(1);
    expect(step.adopted).toBe(0);
  });

  it('counts a bomb 0.211 s into its fuse as adopted', () => {
    const { advance } = setup();
    const step = advance([bomb(5, FUSE - 0.211)]);
    expect(step.births).toBe(0);
    expect(step.adopted).toBe(1);
  });
});
