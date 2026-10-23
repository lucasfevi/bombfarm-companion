import type { LiveBomb, LiveTickHero, UnattributedReason } from '@bombfarm/contracts';
import { FUSE_TOLERANCE, type FingerprintBook, type FingerprintDisagreement } from './fingerprints.js';

export const FRAME_GAME_SECONDS = 0.2;
export const STEP_TOLERANCE = 0.01;

export type OwnerBasis = 'observed' | 'fingerprint';

const WALKING_ACTION_STATE = 5;

export interface RetiredBomb {
  readonly owner: string | null;
  readonly basis?: OwnerBasis;
  readonly radius: number;
  readonly reason?: UnattributedReason;
}

export interface LedgerStep {
  readonly discontinuous: boolean;
  readonly births: number;
  readonly adopted: number;
  readonly owned: number;
  readonly cellOwnerConflicts: number;
  readonly retiredThisFrame: ReadonlyMap<number, RetiredBomb>;
  readonly retiredLastFrame: ReadonlyMap<number, RetiredBomb>;
  readonly disagreements: FingerprintDisagreement[];
}

export interface LedgerInput {
  readonly bombs: readonly LiveBomb[];
  readonly heroes: readonly LiveTickHero[];
  readonly discontinuous: boolean;
}

export interface BombLedger {
  advance(input: LedgerInput): LedgerStep;
  clear(): void;
}

interface LiveEntry {
  readonly fuseTotal: number;
  readonly fuseRemaining: number;
  readonly owner: string | null;
  readonly basis: OwnerBasis | null;
  readonly reason: UnattributedReason | null;
  readonly radius: number;
}

const retirement = (entry: LiveEntry): RetiredBomb => ({
  owner: entry.owner,
  radius: entry.radius,
  ...(entry.basis === null ? {} : { basis: entry.basis }),
  ...(entry.reason === null ? {} : { reason: entry.reason }),
});

const unowned = (retired: RetiredBomb): RetiredBomb => ({
  owner: null,
  radius: retired.radius,
  reason: 'streamDiscontinuity',
});

interface OwnerDecision {
  readonly owner: string | null;
  readonly basis: OwnerBasis | null;
  readonly reason: UnattributedReason | null;
}

interface BirthScene {
  readonly bomb: LiveBomb;
  readonly onCell: readonly LiveTickHero[];
  readonly present: ReadonlySet<string>;
  readonly withLiveBomb: ReadonlySet<string>;
}

const observed = (owner: string): OwnerDecision => ({ owner, basis: 'observed', reason: null });
const byFingerprint = (owner: string): OwnerDecision => ({ owner, basis: 'fingerprint', reason: null });
const undecided = (reason: UnattributedReason): OwnerDecision => ({ owner: null, basis: null, reason });

function narrowed(ids: readonly string[], keep: (id: string) => boolean): readonly string[] {
  const kept = ids.filter(keep);
  return kept.length === 0 ? ids : kept;
}

function chooseOwner(book: FingerprintBook, { bomb, onCell, present, withLiveBomb }: BirthScene): OwnerDecision {
  if (onCell.length === 0) {
    const free = new Set([...present].filter((id) => !withLiveBomb.has(id)));
    const resolution = book.resolve(bomb.fuseTotalSeconds, free);
    return resolution.kind === 'unique' ? byFingerprint(resolution.heroId) : undecided('noOwnerAtBirth');
  }

  const standing = onCell.filter((hero) => hero.actionState !== WALKING_ACTION_STATE);
  const candidates = (standing.length === 0 ? onCell : standing).map((hero) => hero.id);
  const [sole] = candidates;
  if (candidates.length === 1 && sole !== undefined) return observed(sole);

  const sameFuse = narrowed(candidates, (id) => {
    const fuse = book.fuseOf(id);
    return fuse === undefined || Math.abs(fuse - bomb.fuseTotalSeconds) <= FUSE_TOLERANCE;
  });
  const idle = narrowed(sameFuse, (id) => !withLiveBomb.has(id));
  const sameRadius = narrowed(idle, (id) => {
    const radius = book.radiusOf(id);
    return radius === undefined || radius === bomb.radius;
  });
  const [only] = sameRadius;
  return sameRadius.length === 1 && only !== undefined ? observed(only) : undecided('ambiguousPlanter');
}

function isNewBomb(previous: LiveEntry | undefined, bomb: LiveBomb): boolean {
  return (
    previous === undefined ||
    Math.abs(previous.fuseTotal - bomb.fuseTotalSeconds) > FUSE_TOLERANCE ||
    bomb.fuseRemainingSeconds > previous.fuseRemaining
  );
}

function fellByWholeFrames(step: number): boolean {
  const frames = step / FRAME_GAME_SECONDS;
  const whole = Math.round(frames);
  return whole >= 1 && Math.abs(frames - whole) * FRAME_GAME_SECONDS <= STEP_TOLERANCE;
}

export function createBombLedger(book: FingerprintBook): BombLedger {
  let live = new Map<number, LiveEntry>();
  let retiredLast = new Map<number, RetiredBomb>();

  return {
    advance({ bombs, heroes, discontinuous }) {
      const present = new Set(heroes.map((hero) => hero.id));
      const heroesByCell = new Map<number, LiveTickHero[]>();
      for (const hero of heroes) {
        if (hero.cell === undefined) continue;
        const onCell = heroesByCell.get(hero.cell);
        if (onCell === undefined) heroesByCell.set(hero.cell, [hero]);
        else onCell.push(hero);
      }

      const bombsByCell = new Map<number, LiveBomb>();
      for (const bomb of bombs) bombsByCell.set(bomb.cell, bomb);

      const fuseSteps = new Map<number, number>();
      let stepBreaksContinuity = false;
      for (const [cell, bomb] of bombsByCell) {
        const previous = live.get(cell);
        if (previous === undefined || isNewBomb(previous, bomb)) continue;
        const step = previous.fuseRemaining - bomb.fuseRemainingSeconds;
        fuseSteps.set(cell, step);
        if (Math.abs(step - FRAME_GAME_SECONDS) > STEP_TOLERANCE) stepBreaksContinuity = true;
      }
      const frameIsDiscontinuous = discontinuous || stepBreaksContinuity;

      const withLiveBomb = new Set<string>();
      for (const [cell, bomb] of bombsByCell) {
        const previous = live.get(cell);
        if (previous?.owner == null || isNewBomb(previous, bomb)) continue;
        if (!frameIsDiscontinuous || fellByWholeFrames(fuseSteps.get(cell) ?? 0)) withLiveBomb.add(previous.owner);
      }

      const retiredThisFrame = new Map<number, RetiredBomb>();
      const next = new Map<number, LiveEntry>();
      const disagreements: FingerprintDisagreement[] = [];
      let births = 0;
      let adopted = 0;
      let owned = 0;
      let cellOwnerConflicts = 0;

      for (const [cell, bomb] of bombsByCell) {
        const previous = live.get(cell);

        if (previous !== undefined && !isNewBomb(previous, bomb)) {
          const keepsOwner = !frameIsDiscontinuous || fellByWholeFrames(fuseSteps.get(cell) ?? 0);
          next.set(cell, {
            fuseTotal: bomb.fuseTotalSeconds,
            fuseRemaining: bomb.fuseRemainingSeconds,
            radius: previous.radius,
            owner: keepsOwner ? previous.owner : null,
            basis: keepsOwner ? previous.basis : null,
            reason: keepsOwner ? previous.reason : 'streamDiscontinuity',
          });
          continue;
        }

        if (previous !== undefined) retiredThisFrame.set(cell, retirement(previous));

        const fresh = bomb.fuseTotalSeconds - bomb.fuseRemainingSeconds <= FRAME_GAME_SECONDS + STEP_TOLERANCE;
        const onCell = heroesByCell.get(cell) ?? [];
        const soleHero = onCell.length === 1 ? onCell[0]?.id : undefined;

        let decision: OwnerDecision;
        if (fresh) {
          decision = chooseOwner(book, { bomb, onCell, present, withLiveBomb });
        } else {
          const resolution = book.resolve(bomb.fuseTotalSeconds, present);
          decision = resolution.kind === 'unique' ? byFingerprint(resolution.heroId) : undecided('noOwnerAtBirth');
        }

        if (fresh && soleHero !== undefined && !frameIsDiscontinuous) {
          const resolution = book.resolve(bomb.fuseTotalSeconds, present);
          if (resolution.kind === 'unique' && resolution.heroId !== soleHero) cellOwnerConflicts += 1;
          const disagreement = book.learn(soleHero, bomb.fuseTotalSeconds);
          if (disagreement !== null) disagreements.push(disagreement);
        }
        if (fresh && decision.basis === 'observed' && decision.owner === soleHero) {
          book.learnRadius(decision.owner, bomb.radius);
        }

        if (fresh) {
          births += 1;
          if (decision.owner !== null) owned += 1;
        } else {
          adopted += 1;
        }

        next.set(cell, {
          fuseTotal: bomb.fuseTotalSeconds,
          fuseRemaining: bomb.fuseRemainingSeconds,
          radius: bomb.radius,
          owner: decision.owner,
          basis: decision.basis,
          reason: decision.reason,
        });
      }

      for (const [cell, previous] of live) {
        if (!bombsByCell.has(cell)) retiredThisFrame.set(cell, retirement(previous));
      }

      const retiredLastFrame = retiredLast;
      retiredLast = new Map(
        [...retiredThisFrame].map(([cell, retired]) => [cell, frameIsDiscontinuous ? unowned(retired) : retired]),
      );
      live = next;

      return {
        discontinuous: frameIsDiscontinuous,
        births,
        adopted,
        owned,
        cellOwnerConflicts,
        retiredThisFrame,
        retiredLastFrame,
        disagreements,
      };
    },

    clear() {
      live = new Map();
      retiredLast = new Map();
    },
  };
}
