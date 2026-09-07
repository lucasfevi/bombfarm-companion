import {
  DEFAULT_TIMEOUT_MS,
  authorizedHeaders,
  classifyResponse,
  type HttpRequestTarget,
  type HttpResponse,
  type HttpTransport,
  type RequestOptions,
  type RequestOutcome,
} from './request.js';
import { WriteSessionRequiredError, isWriteSession, type WriteSession } from './write-session.js';

/**
 * The write twin of `request.ts`, and the only module in the app that can build a POST. It
 * knows exactly two routes — the same two calls the game's own forge screen makes — and refuses
 * anything else at runtime, the way `sendGet` refuses a host or method it was not built for.
 * Headers, classifier and timeout are `request.ts`'s own; the token is still read only there.
 */

const HOST = 'app.bombfarm.net';
const METHOD = 'POST';

export const FORGE_ROUTES = {
  forge: '/item/forge',
  forgeToSafe: '/item/forge_to_safe',
} as const;

export type ForgeRoute = (typeof FORGE_ROUTES)[keyof typeof FORGE_ROUTES];

const FORGE_ROUTE_SET: ReadonlySet<string> = new Set(Object.values(FORGE_ROUTES));

export interface HttpWriteRequest extends HttpRequestTarget {
  readonly method: typeof METHOD;
}

function routePart(path: string): string {
  return path.split('?')[0] ?? '';
}

/** Runtime-checks `session` first — a value that only *types* as `WriteSession` without being
 *  minted by `grantWriteSession` throws before any header is built. */
export function buildForgeRequest(
  session: WriteSession,
  route: ForgeRoute,
  itemId: string,
  opts?: RequestOptions,
): HttpWriteRequest {
  if (!isWriteSession(session)) {
    throw new WriteSessionRequiredError();
  }
  return {
    host: HOST,
    method: METHOD,
    path: `${route}?item=${encodeURIComponent(itemId)}`,
    headers: { ...authorizedHeaders(session.session), 'Content-Length': '0' },
    timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(opts?.signal ? { signal: opts.signal } : {}),
  };
}

/** Runtime half of the two-routes invariant. Typed structurally, like `isTrustedHttpRequest`,
 *  because against `HttpWriteRequest`'s literal types the host and method comparisons are
 *  statically always true — the unsafe-cast case is the one this exists to catch. */
export function isTrustedWriteRequest(req: {
  readonly host: string;
  readonly method: string;
  readonly path: string;
}): boolean {
  return req.host === HOST && req.method === METHOD && FORGE_ROUTE_SET.has(routePart(req.path));
}

export async function sendPost(req: HttpWriteRequest, transport: HttpTransport): Promise<RequestOutcome> {
  if (!isTrustedWriteRequest(req)) {
    return {
      kind: 'transport_error',
      message: `refused: ${req.host} ${req.method} ${routePart(req.path)} is not one of the two allowed forge calls`,
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
  route: ForgeRoute,
  itemId: string,
  opts?: RequestOptions,
): Promise<RequestOutcome> {
  const req = buildForgeRequest(session, route, itemId, opts);
  return sendPost(req, transport);
}
