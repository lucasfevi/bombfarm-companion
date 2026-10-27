import type { AccountPayload, CommitVector } from '@bombfarm/contracts';
import type { HeroDetailReading } from '@bombfarm/game-api';

export type ReadHeroAllocation = (heroId: string) => Promise<HeroDetailReading>;

/** A failed reading is not retried for the same sheet inside this window, so a hero the renderer
 *  keeps asking about cannot turn every account cycle into another request. */
export const FAILED_READ_RETRY_MS = 5 * 60_000;

/**
 * The server's own allocation for the heroes the renderer names — the ones whose spent points its
 * import cannot recover exactly from the sheet, since a stat at its cap hides points the sheet
 * cannot show. Main never parses the roster itself; it only reads, keeps each reading against the
 * sheet it was read beside, and attaches it as `alloc` while that sheet is unchanged.
 */
export interface ServerAllocations {
  /** `payload` with every reading whose hero still shows the sheet it was read beside. */
  withCached(payload: AccountPayload): AccountPayload;
  /** Reads each named hero of `payload` that holds no current reading; true when any landed. */
  read(payload: AccountPayload, heroIds: readonly string[], read: ReadHeroAllocation): Promise<boolean>;
}

type Reading = { readonly sheetKey: string; readonly alloc: CommitVector };
type FailedRead = { readonly sheetKey: string; readonly atMs: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sheetKeyOf(hero: Record<string, unknown>): string {
  return JSON.stringify([hero.level, hero.stat_points_available, hero.stats]);
}

function heroesById(payload: AccountPayload): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const hero of payload.heroes ?? []) {
    if (isRecord(hero) && typeof hero.id === 'string') byId.set(hero.id, hero);
  }
  return byId;
}

async function readOk(read: ReadHeroAllocation, heroId: string): Promise<CommitVector | null> {
  try {
    const reading = await read(heroId);
    return reading.kind === 'ok' ? reading.alloc : null;
  } catch {
    return null;
  }
}

export function createServerAllocations(nowMs: () => number = Date.now): ServerAllocations {
  const readings = new Map<string, Reading>();
  const failures = new Map<string, FailedRead>();

  function currentReading(heroId: string, hero: Record<string, unknown>): CommitVector | null {
    const reading = readings.get(heroId);
    return reading !== undefined && reading.sheetKey === sheetKeyOf(hero) ? reading.alloc : null;
  }

  return {
    withCached(payload) {
      if (readings.size === 0 || payload.heroes === undefined) return payload;
      const heroes = payload.heroes.map((hero) => {
        if (!isRecord(hero) || typeof hero.id !== 'string') return hero;
        const alloc = currentReading(hero.id, hero);
        return alloc === null ? hero : { ...hero, alloc };
      });
      return { ...payload, heroes };
    },

    async read(payload, heroIds, read) {
      const heroes = heroesById(payload);
      let landed = false;
      for (const heroId of new Set(heroIds)) {
        const hero = heroes.get(heroId);
        if (hero === undefined || currentReading(heroId, hero) !== null) continue;
        const sheetKey = sheetKeyOf(hero);
        const failure = failures.get(heroId);
        if (failure?.sheetKey === sheetKey && nowMs() - failure.atMs < FAILED_READ_RETRY_MS) continue;
        const alloc = await readOk(read, heroId);
        if (alloc === null) {
          failures.set(heroId, { sheetKey, atMs: nowMs() });
          continue;
        }
        failures.delete(heroId);
        readings.set(heroId, { sheetKey, alloc });
        landed = true;
      }
      return landed;
    },
  };
}
