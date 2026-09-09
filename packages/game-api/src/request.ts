import type { HttpWriteRequest } from './forge-request.js';
import { ConsentedSessionRequiredError, RAW, isConsentedSession, type ConsentedSession } from './session.js';

/**
 * The one read request function (one host, HTTPS, GET; every pacing failure gets a distinct
 * named status). Adapted from the internal automation prototype's
 * API client — the 15 s timeout is reused; `FALLBACK_IPS` and the IP-retry
 * loop are deliberately not ported (transport failure gets a named status, not an IP fallback).
 * The write twin, `forge-request.ts`, is the only module that may build a POST, and it reuses
 * this module's headers, classifier and timeout rather than carrying a second copy.
 *
 * `host`/`method` are literal types so a different value is not expressible at the call site
 * (the one-host/HTTPS/GET-only invariant's compile-time half). `isTrustedHttpRequest` is the
 * runtime half of that same
 * invariant — belt-and-suspenders per the illegal-states-unrepresentable rule's "type AND
 * runtime" shape, exercised directly in
 * `request.test.ts` against a request corrupted through an unsafe cast (the only way a mismatched
 * host could ever reach this module, since `buildHttpRequest` always builds the trusted target).
 *
 * `buildHttpRequest` also runs `isConsentedSession` on its `session` argument before touching the
 * token — the same three-mechanism pattern applied one hop downstream of `grantSession` itself
 * (the same unrepresentable-illegal-states rule, and consent as a capability whose token is
 * redacted by its type): a `ConsentedSession` forged with `as unknown as ConsentedSession` is well
 * typed at its call site but carries none of `grantSession`'s runtime brand, so it is rejected
 * here rather than sailing through into a fully-formed authenticated request.
 */

const HOST = 'app.bombfarm.net';
const METHOD = 'GET';

/** Protocol constant, beside the other request-shaping ones. The product half lives here; the
 *  version is the running app's and is injected by whoever builds the transport, since this
 *  package cannot know it. Carries no contact URL — `apps/desktop`'s boundary guard forbids that
 *  process naming any host but the API. */
export function companionUserAgent(appVersion: string): string {
  return `Bomb Farm Companion/${appVersion}`;
}

/** Conservative, unmeasured — rejecting a response this large is safer than buffering it whole. */
const MAX_RESPONSE_BYTES = 2_000_000;

/** Reused from the internal automation prototype's rate-limit module — the cooldown-shaped-body detector. */
const COOLDOWN_BODY_PATTERN = /"(?:err|error|code)"\s*:\s*"[^"]*(?:RATE|COOLDOWN|TOO_MANY)[^"]*"/i;

const PREVIEW_LENGTH = 200;

/** Everything a request carries except its method — the read and write shapes each pin their own. */
export interface HttpRequestTarget {
  readonly host: typeof HOST;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface HttpRequest extends HttpRequestTarget {
  readonly method: typeof METHOD;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: string;
}

export type HttpTransport = (req: HttpRequest | HttpWriteRequest) => Promise<HttpResponse>;

export type RequestOutcome =
  | { readonly kind: 'ok'; readonly status: 200; readonly json: unknown }
  /** `status` is not narrowed to 401/403: the server also names a dead session in the body of an
   *  otherwise-successful response, and that has to be representable. */
  | { readonly kind: 'unauthorized'; readonly status: number; readonly code: string | null }
  /** The server named a refusal in the body (`{"error":"SERVER_LOCKED"}`) — at any status,
   *  including 200. Distinct from `http_error`, which is a status with nothing named. */
  | { readonly kind: 'api_error'; readonly status: number; readonly code: string }
  | { readonly kind: 'cooldown'; readonly status: number; readonly retryHint: string | null }
  | { readonly kind: 'http_error'; readonly status: number; readonly preview: string }
  | { readonly kind: 'malformed_json'; readonly preview: string }
  | { readonly kind: 'too_large'; readonly bytes: number }
  | { readonly kind: 'transport_error'; readonly message: string };

export interface RequestOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/** The one place the token is read: through the module-private `RAW` symbol, straight into the
 *  `Authorization` header, for the read builder below and the write builder in
 *  `forge-request.ts` alike.
 *
 *  Runtime-checks `session` first (see module doc comment) — a value that only *types* as
 *  `ConsentedSession` without actually being minted by `grantSession` throws
 *  `ConsentedSessionRequiredError` before any header is built. */
export function authorizedHeaders(session: ConsentedSession): Readonly<Record<string, string>> {
  if (!isConsentedSession(session)) {
    throw new ConsentedSessionRequiredError();
  }
  return {
    Authorization: `Bearer ${session.token[RAW]()}`,
    Accept: 'application/json',
    Host: HOST,
    Connection: 'close',
  };
}

/** The game sends `account_id` as the first query parameter on every account-scoped route, and the
 *  server cross-checks it against the account the bearer token resolves to — a mismatch comes back
 *  as `WRONG_ACCOUNT`. It is the account identifier the server actually expects to see; the token
 *  alone is never how the client asks. Both builders below go through here so the read and write
 *  paths cannot drift apart. */
export function withAccountId(path: string, accountId: string): string {
  return `${path}?account_id=${encodeURIComponent(accountId)}`;
}

export function buildHttpRequest(
  session: ConsentedSession,
  path: string,
  opts?: RequestOptions,
): HttpRequest {
  return {
    host: HOST,
    method: METHOD,
    path: withAccountId(path, session.accountId),
    headers: authorizedHeaders(session),
    timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(opts?.signal ? { signal: opts.signal } : {}),
  };
}

/**
 * Runtime half of the one-host/HTTPS/GET-only invariant — see the module doc comment above. The
 * parameter is typed structurally as `{ host: string; method: string }` rather than `HttpRequest`
 * on purpose: against `HttpRequest`'s literal types this comparison is statically always true,
 * which is exactly the case (a value that bypassed the type system via an unsafe cast) this guard
 * exists to catch at runtime.
 */
export function isTrustedHttpRequest(req: { readonly host: string; readonly method: string }): boolean {
  return req.host === HOST && req.method === METHOD;
}

function preview(body: string): string {
  return body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH)}…` : body;
}

function extractRetryHint(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const hint = parsed.retry_after ?? parsed.retryAfter ?? parsed.err ?? parsed.error ?? parsed.code;
    if (typeof hint === 'string') return hint;
    if (typeof hint === 'number') return String(hint);
    return null;
  } catch {
    return null;
  }
}

/** The codes that mean this session is over. The game clears its stored token and re-authenticates
 *  on exactly these; treating them as anything softer leaves us retrying with a dead token. */
const SESSION_DEAD_CODES: ReadonlySet<string> = new Set([
  'NO_TOKEN',
  'BAD_TOKEN',
  'WRONG_ACCOUNT',
  'SESSION_EXPIRED',
]);

/** The server names a refusal as `{"error": "CODE"}`, and the game screens for it on EVERY
 *  response before the per-route handler runs — at any status, 200 included. Without this, a
 *  refusal body on a 200 parses as a perfectly good JSON object and is committed as account
 *  state. */
function apiErrorCode(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const code = (parsed as Record<string, unknown>).error;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

/** Maps a raw response into a `RequestOutcome` — every branch names a distinct, closed reason.
 *  Order matters: size, then auth (status OR named code), then cooldown (status OR shape), then a
 *  named refusal at any status, then generic error, then success. Shared with
 *  `forge-request.ts`: a forge roll's cooldown reads the same way. */
export function classifyResponse(status: number, body: string): RequestOutcome {
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > MAX_RESPONSE_BYTES) {
    return { kind: 'too_large', bytes };
  }

  const code = apiErrorCode(body);

  if (code !== null && SESSION_DEAD_CODES.has(code)) {
    return { kind: 'unauthorized', status, code };
  }

  if (status === 401 || status === 403) {
    return { kind: 'unauthorized', status, code };
  }

  const cooldownShaped = COOLDOWN_BODY_PATTERN.test(body);
  if (status === 429 || status === 503 || cooldownShaped) {
    return { kind: 'cooldown', status, retryHint: extractRetryHint(body) };
  }

  // Before the status branches below, so a named refusal on a 200 can never read as `ok`.
  if (code !== null) {
    return { kind: 'api_error', status, code };
  }

  if (status >= 400) {
    return { kind: 'http_error', status, preview: preview(body) };
  }

  if (status === 200) {
    try {
      const json: unknown = JSON.parse(body);
      return { kind: 'ok', status: 200, json };
    } catch {
      return { kind: 'malformed_json', preview: preview(body) };
    }
  }

  return { kind: 'http_error', status, preview: preview(body) };
}

/** The lower-level send: takes an already-built `HttpRequest`, refuses one whose host/method
 *  do not match the trusted target before touching the transport, classifies the transport's
 *  response (or its failure) into a `RequestOutcome`. `requestGet` below is the documented public
 *  entry point; this is exported so the refusal path is directly testable (see module doc). */
export async function sendGet(req: HttpRequest, transport: HttpTransport): Promise<RequestOutcome> {
  if (!isTrustedHttpRequest(req)) {
    return {
      kind: 'transport_error',
      message: `refused: ${req.host} ${req.method} is not the allowed app.bombfarm.net GET`,
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

/** The one read request function (one host, HTTPS, GET). No `node:https`, no `fetch` — the transport is injected. */
export async function requestGet(
  session: ConsentedSession,
  transport: HttpTransport,
  path: string,
  opts?: RequestOptions,
): Promise<RequestOutcome> {
  const req = buildHttpRequest(session, path, opts);
  return sendGet(req, transport);
}
