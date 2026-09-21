import { isCommitVector, type CommitVector } from '@bombfarm/contracts';
import { PacingRefusedError, type PacingGate } from './pacing.js';
import { requestGet, type HttpTransport } from './request.js';
import type { ConsentedSession } from './session.js';
import { isPlainObject } from './type-guards.js';

/**
 * The sixth read: one hero's true stat-point allocation, through the same gate as the five
 * account sections. Not a `ROUTES` entry — it is read on demand, per hero, rather than every
 * account cycle — but it shares `routes.ts`'s refuse-and-classify shape and `request.ts`'s
 * `classifyResponse`.
 */

export const HERO_DETAIL_PATH = '/hero/detail';

export function heroDetailPath(heroId: string): string {
  return `${HERO_DETAIL_PATH}?hero=${encodeURIComponent(heroId)}`;
}

export type HeroDetailFailureReason =
  | 'unauthorized'
  | 'cooldown'
  | 'api_error'
  | 'http_error'
  | 'malformed_json'
  | 'too_large'
  | 'transport_error'
  | 'bad_shape';

export type HeroDetailReading =
  | {
      readonly kind: 'ok';
      readonly alloc: CommitVector;
      readonly spent: number;
      readonly available: number | null;
      readonly respecGold: number | null;
    }
  | {
      readonly kind: 'failed';
      readonly reason: HeroDetailFailureReason;
      readonly code?: string;
      readonly status?: number;
    };

function parseSpent(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseOptionalInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function parseGoldCost(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Reads one hero's allocation through the gate. Never throws for an ordinary failure — every
 *  branch resolves to a named `HeroDetailReading`. */
export async function readHeroDetail(
  session: ConsentedSession,
  transport: HttpTransport,
  gate: PacingGate,
  heroId: string,
): Promise<HeroDetailReading> {
  const path = heroDetailPath(heroId);
  let outcome: Awaited<ReturnType<typeof requestGet>>;
  try {
    outcome = await gate.run(path, () => requestGet(session, transport, path));
  } catch (error) {
    if (error instanceof PacingRefusedError) {
      return { kind: 'failed', reason: error.gateState === 'halted' ? 'unauthorized' : 'cooldown' };
    }
    throw error;
  }

  gate.observe(outcome);

  switch (outcome.kind) {
    case 'ok': {
      if (!isPlainObject(outcome.json)) {
        return { kind: 'failed', reason: 'bad_shape' };
      }
      const body = outcome.json;
      const alloc = isCommitVector(body.alloc) ? body.alloc : null;
      const spent = parseSpent(body.stat_points_spent);
      if (alloc === null || spent === null) {
        return { kind: 'failed', reason: 'bad_shape' };
      }
      return {
        kind: 'ok',
        alloc,
        spent,
        available: parseOptionalInt(body.stat_points_available),
        respecGold: parseGoldCost(body.respec_gold_cost),
      };
    }
    case 'unauthorized':
      return outcome.code === null
        ? { kind: 'failed', reason: 'unauthorized' }
        : { kind: 'failed', reason: 'unauthorized', code: outcome.code };
    case 'api_error':
      return { kind: 'failed', reason: 'api_error', code: outcome.code };
    case 'cooldown':
      return { kind: 'failed', reason: 'cooldown' };
    case 'http_error':
      return { kind: 'failed', reason: 'http_error', status: outcome.status };
    case 'malformed_json':
      return { kind: 'failed', reason: 'malformed_json' };
    case 'too_large':
      return { kind: 'failed', reason: 'too_large' };
    case 'transport_error':
      return { kind: 'failed', reason: 'transport_error' };
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
