import type { AccountSection } from '@bombfarm/contracts';
import { ROUTE_FINGERPRINTS } from './fingerprints.js';
import { PacingRefusedError, type PacingGate } from './pacing.js';
import { requestGet, type HttpTransport } from './request.js';
import { checkShape } from './shape.js';
import type { ConsentedSession } from './session.js';

/**
 * The five GET readers and their projections into the section a shape the contract expects
 * (LAR-07 route half, LAR-19/20 detection half, LAR-25 section half).
 */
export interface RouteDescriptor {
  readonly section: AccountSection;
  readonly path: '/state' | '/roster' | '/skill/state' | '/rotation' | '/inventory';
  /** `/roster` -> `.heroes`, `/inventory` -> `.items`; identity for the rest — including
   *  `/rotation`, whose whole body (field list, per-hero rotation state, house, rescues) is the
   *  `casa` section now, not just its `casa` child. */
  readonly project: (body: Record<string, unknown>) => unknown;
  /** Arrays must be non-empty for `heroes` — an account with zero heroes cannot produce planner
   *  advice and is far more likely to be an error body (spec edge case). Everything else just
   *  needs the right JS shape (object for scalar sections, array for `items`). */
  readonly acceptProjected: (projected: unknown) => boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const ROUTES: readonly RouteDescriptor[] = [
  {
    section: 'account',
    path: '/state',
    project: (body) => body,
    acceptProjected: isPlainObject,
  },
  {
    section: 'heroes',
    path: '/roster',
    project: (body) => body.heroes,
    acceptProjected: (projected) => Array.isArray(projected) && projected.length > 0,
  },
  {
    section: 'skills',
    path: '/skill/state',
    project: (body) => body,
    acceptProjected: isPlainObject,
  },
  {
    section: 'casa',
    path: '/rotation',
    project: (body) => body,
    acceptProjected: isPlainObject,
  },
  {
    section: 'items',
    path: '/inventory',
    project: (body) => body.items,
    acceptProjected: (projected) => Array.isArray(projected),
  },
];

/**
 * A closed vocabulary for "why this section has no body this cycle" (LAR-25). The first seven
 * members are produced by `readSection` below, driven by `RequestOutcome` (T3) and the shape
 * guard (T5). The last three — `not_consented`, `token_unavailable`, `aborted` — are produced by
 * `apps/desktop/src/main/game-api/account-refresh.ts` (T8): they describe states that never reach
 * a route at all (no consent, no token, or a revoke that cancelled this route before it started),
 * so `routes.ts` cannot be the one to produce them. Both halves are covered by tests — the first
 * seven here, the last three in T8's suite — so no member of this union ships unreachable.
 */
export type SectionFailureReason =
  | 'unauthorized'
  | 'cooldown'
  | 'http_error'
  | 'malformed_json'
  | 'too_large'
  | 'transport_error'
  | 'empty_roster'
  | 'not_consented'
  | 'token_unavailable'
  | 'aborted';

export type SectionOutcome =
  | { readonly kind: 'ok'; readonly body: unknown }
  | {
      readonly kind: 'drift';
      readonly body: unknown;
      readonly missingKeys: readonly string[];
      readonly addedKeys: readonly string[];
    }
  | { readonly kind: 'failed'; readonly reason: SectionFailureReason };

/** Reads one route through the pacing gate, checks its shape, and projects it. Never throws for
 *  an ordinary failure — every branch resolves to a named `SectionOutcome`. */
export async function readSection(
  session: ConsentedSession,
  transport: HttpTransport,
  gate: PacingGate,
  route: RouteDescriptor,
): Promise<SectionOutcome> {
  let outcome: Awaited<ReturnType<typeof requestGet>>;
  try {
    outcome = await gate.run(route.path, () => requestGet(session, transport, route.path));
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
        return { kind: 'failed', reason: 'malformed_json' };
      }
      const fingerprint = ROUTE_FINGERPRINTS[route.section];
      const shape = checkShape(outcome.json, fingerprint);
      const projected = route.project(outcome.json);
      if (!shape.ok) {
        // The shape broke, but the section may still be usable: project anyway and only give up
        // on it (fall through to `failed`) if the drifted body doesn't even hold the shape this
        // section's own consumers require (e.g. the key being projected is itself gone).
        if (route.acceptProjected(projected)) {
          return { kind: 'drift', body: projected, missingKeys: shape.missingKeys, addedKeys: shape.addedKeys };
        }
        return { kind: 'failed', reason: 'empty_roster' };
      }
      if (!route.acceptProjected(projected)) {
        return { kind: 'failed', reason: 'empty_roster' };
      }
      return { kind: 'ok', body: projected };
    }
    case 'unauthorized':
      return { kind: 'failed', reason: 'unauthorized' };
    case 'cooldown':
      return { kind: 'failed', reason: 'cooldown' };
    case 'http_error':
      return { kind: 'failed', reason: 'http_error' };
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
