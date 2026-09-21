import { isCommitVector, type CommitVector } from '@bombfarm/contracts';
import {
  DEFAULT_TIMEOUT_MS,
  authorizedHeaders,
  classifyResponse,
  type HttpRequestTarget,
  type HttpResponse,
  type HttpTransport,
  type RequestOptions,
  type RequestOutcome,
  withAccountId,
} from './request.js';
import { WriteSessionRequiredError, isWriteSession, type WriteSession } from './write-session.js';

/**
 * The write twin of `request.ts`, and the only module in the app that can build a POST. It
 * knows six routes — a forge roll, equipping or unequipping an item, and refunding or
 * re-placing a hero's stat points — and refuses anything else at runtime, the way `sendGet`
 * refuses a host or method it was not built for. Headers, classifier and timeout are
 * `request.ts`'s own; the token is still read only there.
 */

const HOST = 'app.bombfarm.net';
const METHOD = 'POST';

export const WRITE_ROUTES = {
  forge: '/item/forge',
  forgeToSafe: '/item/forge_to_safe',
  equip: '/item/equip',
  unequip: '/item/unequip',
  respec: '/hero/stat/respec',
  commit: '/hero/stat/commit',
} as const;

/** Unchanged subset — the two routes the forge run has always used. */
export const FORGE_ROUTES = { forge: WRITE_ROUTES.forge, forgeToSafe: WRITE_ROUTES.forgeToSafe } as const;

export type WriteRoute = (typeof WRITE_ROUTES)[keyof typeof WRITE_ROUTES];
export type ForgeRoute = (typeof FORGE_ROUTES)[keyof typeof FORGE_ROUTES];

const WRITE_ROUTE_SET: ReadonlySet<string> = new Set(Object.values(WRITE_ROUTES));

export interface HttpWriteRequest extends HttpRequestTarget {
  readonly method: typeof METHOD;
}

export type WriteCall =
  | { readonly route: ForgeRoute | typeof WRITE_ROUTES.unequip; readonly item: string }
  | { readonly route: typeof WRITE_ROUTES.equip; readonly item: string; readonly hero: string }
  | { readonly route: typeof WRITE_ROUTES.respec; readonly hero: string }
  | { readonly route: typeof WRITE_ROUTES.commit; readonly hero: string; readonly points: CommitVector };

/** Thrown by `buildWriteRequest` before any header is built, when a `commit` call's `points`
 *  is not a well-formed `CommitVector` — the runtime half of the tuple type. */
export class InvalidWriteCallError extends Error {
  constructor(message: string) {
    super(`InvalidWriteCallError: ${message}`);
    this.name = 'InvalidWriteCallError';
  }
}

function routePart(path: string): string {
  return path.split('?')[0] ?? '';
}

/**
 * The game client stamps every POST with `request_id=c<uptime ms>-<sequence>-<random 0..999999>`
 * and reuses that same id if it re-sends the request, which is what makes a resent write safe to
 * discard server-side. This reproduces that key exactly, including its `c` prefix and the
 * uptime-not-epoch clock, so a write of ours is deduplicable the same way a write of the game's
 * is.
 *
 * The value is generated once per write. A write that is ever retried must carry the id it was
 * built with, not a fresh one — a new id is a new call, and every one of these six spends
 * something real.
 */
export interface RequestIdSource {
  next(): string;
}

export function createRequestIdSource(deps: {
  readonly uptimeMs: () => number;
  readonly random: () => number;
}): RequestIdSource {
  let sequence = 0;
  return {
    next(): string {
      sequence += 1;
      const uptime = Math.max(Math.floor(deps.uptimeMs()), 0);
      const draw = Math.floor(deps.random() * 1_000_000);
      return `c${String(uptime)}-${String(sequence)}-${String(draw)}`;
    },
  };
}

function hasItem(call: WriteCall): call is Extract<WriteCall, { item: string }> {
  return 'item' in call;
}

function hasHero(call: WriteCall): call is Extract<WriteCall, { hero: string }> {
  return 'hero' in call;
}

/** Runtime-checks `session` first — a value that only *types* as `WriteSession` without being
 *  minted by `grantWriteSession` throws before any header is built. A `commit` call whose
 *  `points` fails `isCommitVector` throws `InvalidWriteCallError`, also before any header. */
export function buildWriteRequest(
  session: WriteSession,
  call: WriteCall,
  requestId: string,
  opts?: RequestOptions,
): HttpWriteRequest {
  if (!isWriteSession(session)) {
    throw new WriteSessionRequiredError();
  }
  if (call.route === WRITE_ROUTES.commit && !isCommitVector(call.points)) {
    throw new InvalidWriteCallError('a commit call requires an eight-element, non-negative-integer points vector');
  }

  let path = withAccountId(call.route, session.session.accountId);
  if (hasItem(call)) path += `&item=${encodeURIComponent(call.item)}`;
  if (hasHero(call)) path += `&hero=${encodeURIComponent(call.hero)}`;
  if (call.route === WRITE_ROUTES.commit) {
    path += `&points=${encodeURIComponent(call.points.join(','))}`;
  }
  path += `&request_id=${encodeURIComponent(requestId)}`;

  return {
    host: HOST,
    method: METHOD,
    path,
    headers: { ...authorizedHeaders(session.session), 'Content-Length': '0' },
    timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(opts?.signal ? { signal: opts.signal } : {}),
  };
}

/** Runtime half of the six-routes invariant. Typed structurally, like `isTrustedHttpRequest`,
 *  because against `HttpWriteRequest`'s literal types the host and method comparisons are
 *  statically always true — the unsafe-cast case is the one this exists to catch. */
export function isTrustedWriteRequest(req: {
  readonly host: string;
  readonly method: string;
  readonly path: string;
}): boolean {
  return req.host === HOST && req.method === METHOD && WRITE_ROUTE_SET.has(routePart(req.path));
}

export async function sendPost(req: HttpWriteRequest, transport: HttpTransport): Promise<RequestOutcome> {
  if (!isTrustedWriteRequest(req)) {
    return {
      kind: 'transport_error',
      message: `refused: ${req.host} ${req.method} ${routePart(req.path)} is not one of the app's allowed writes`,
    };
  }

  let response: HttpResponse;
  try {
    response = await transport(req);
  } catch (error) {
    return { kind: 'transport_error', message: error instanceof Error ? error.message : String(error) };
  }

  return classifyResponse(response.status, response.body);
}

/** The one write request function. No `node:https`, no `fetch` — the transport is injected. */
export async function requestPost(
  session: WriteSession,
  transport: HttpTransport,
  call: WriteCall,
  requestId: string,
  opts?: RequestOptions,
): Promise<RequestOutcome> {
  const req = buildWriteRequest(session, call, requestId, opts);
  return sendPost(req, transport);
}
