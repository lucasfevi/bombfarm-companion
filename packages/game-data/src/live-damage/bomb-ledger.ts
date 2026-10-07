import type { LiveBomb, LiveTickHero, UnattributedReason } from '@bombfarm/contracts';
import { FUSE_TOLERANCE, type FingerprintBook, type FingerprintDisagreement } from './fingerprints.js';

export const FRAME_GAME_SECONDS = 0.2;
export const STEP_TOLERANCE = 0.01;

export interface RetiredBomb {
  readonly owner: string | null;
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
  readonly reason: UnattributedReason | null;
  readonly radius: number;
}

const retirement = (entry: LiveEntry): RetiredBomb =>
  entry.reason === null
    ? { owner: entry.owner, radius: entry.radius }
    : { owner: entry.owner, radius: entry.radius, reason: entry.reason };

const unowned = (retired: RetiredBomb): RetiredBomb => ({
  owner: null,
  radius: retired.radius,
  reason: 'streamDiscontinuity',
});

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
      const heroesByCell = new Map<number, string[]>();
      for (const hero of heroes) {
        if (hero.cell === undefined) continue;
        const onCell = heroesByCell.get(hero.cell);
        if (onCell === undefined) heroesByCell.set(hero.cell, [hero.id]);
        else onCell.push(hero.id);
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
            reason: keepsOwner ? previous.reason : 'streamDiscontinuity',
          });
          continue;
        }

        if (previous !== undefined) retiredThisFrame.set(cell, retirement(previous));

        const fresh = bomb.fuseTotalSeconds - bomb.fuseRemainingSeconds <= FRAME_GAME_SECONDS + STEP_TOLERANCE;
        const onCell = heroesByCell.get(cell) ?? [];
        const resolution = book.resolve(bomb.fuseTotalSeconds, present);

        let owner: string | null = null;
        if (resolution.kind === 'unique') owner = resolution.heroId;
        else if (fresh && onCell.length === 1) owner = onCell[0] ?? null;

        if (fresh && !frameIsDiscontinuous && onCell.length === 1) {
          const [soleHero] = onCell as [string];
          if (resolution.kind === 'unique' && resolution.heroId !== soleHero) {
            cellOwnerConflicts += 1;
          } else {
            const disagreement = book.learn(soleHero, bomb.fuseTotalSeconds);
            if (disagreement !== null) disagreements.push(disagreement);
          }
        }

        if (fresh) {
          births += 1;
          if (owner !== null) owned += 1;
        } else {
          adopted += 1;
        }

        next.set(cell, {
          fuseTotal: bomb.fuseTotalSeconds,
          fuseRemaining: bomb.fuseRemainingSeconds,
          radius: bomb.radius,
          owner,
          reason: owner === null ? 'noOwnerAtBirth' : null,
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
