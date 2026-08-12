import { ConsentedSessionRequiredError, RAW, isConsentedSession, type ConsentedSession } from './session.js';

/**
 * The one request function (LAR-13, LAR-23…25). Adapted from
 * `bombfarm-bot/src/lib/api.ts:107-181` — the header set and the 15 s timeout are reused;
 * `FALLBACK_IPS` and the IP-retry loop are deliberately not ported (TD-9, LAR-24).
 *
 * `host`/`method` are literal types so a different value is not expressible at the call site
 * (LAR-13's compile-time half). `isTrustedHttpRequest` is the runtime half of that same
 * invariant — belt-and-suspenders per `AD-025`'s "type AND runtime" shape, exercised directly in
 * `request.test.ts` against a request corrupted through an unsafe cast (the only way a mismatched
 * host could ever reach this module, since `buildHttpRequest` always builds the trusted target).
 *
 * `buildHttpRequest` also runs `isConsentedSession` on its `session` argument before touching the
 * token — the same three-mechanism pattern applied one hop downstream of `grantSession` itself
 * (`AD-025`/`AD-028`): a `ConsentedSession` forged with `as unknown as ConsentedSession` is well
 * typed at its call site but carries none of `grantSession`'s runtime brand, so it is rejected
 * here rather than sailing through into a fully-formed authenticated request.
 */

const HOST = 'api.bombfarm.net';
const METHOD = 'GET';

/** Conservative, unmeasured — rejecting a response this large is safer than buffering it whole. */
const MAX_RESPONSE_BYTES = 2_000_000;

/** Reused from `bombfarm-bot/src/lib/rate-limit.ts:9-10` — the cooldown-shaped-body detector. */
const COOLDOWN_BODY_PATTERN = /"(?:err|error|code)"\s*:\s*"[^"]*(?:RATE|COOLDOWN|TOO_MANY)[^"]*"/i;

const PREVIEW_LENGTH = 200;

export interface HttpRequest {
  readonly host: typeof HOST;
  readonly method: typeof METHOD;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: string;
}

export type HttpTransport = (req: HttpRequest) => Promise<HttpResponse>;

export type RequestOutcome =
  | { readonly kind: 'ok'; readonly status: 200; readonly json: unknown }
  | { readonly kind: 'unauthorized'; readonly status: 401 | 403 }
  | { readonly kind: 'cooldown'; readonly status: number; readonly retryHint: string | null }
  | { readonly kind: 'http_error'; readonly status: number; readonly preview: string }
  | { readonly kind: 'malformed_json'; readonly preview: string }
  | { readonly kind: 'too_large'; readonly bytes: number }
  | { readonly kind: 'transport_error'; readonly message: string };

export interface RequestOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** Builds the request. The token is read through the module-private `RAW` symbol here, and
 *  nowhere else in this package — it goes straight into the `Authorization` header.
 *
 *  Runtime-checks `session` first (see module doc comment) — a value that only *types* as
 *  `ConsentedSession` without actually being minted by `grantSession` throws
 *  `ConsentedSessionRequiredError` before any header is built. */
export function buildHttpRequest(
  session: ConsentedSession,
  path: string,
  opts?: RequestOptions,
): HttpRequest {
  if (!isConsentedSession(session)) {
    throw new ConsentedSessionRequiredError();
  }
  return {
    host: HOST,
    method: METHOD,
    path,
    headers: {
      Authorization: `Bearer ${session.token[RAW]()}`,
      'X-Account-Id': session.accountId,
      Accept: 'application/json',
      Host: HOST,
      Connection: 'close',
    },
    timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(opts?.signal ? { signal: opts.signal } : {}),
  };
}

/**
 * Runtime half of LAR-13's host/method invariant — see the module doc comment above. The
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

/** Maps a raw response into a `RequestOutcome` — every branch names a distinct, closed reason
 *  (LAR-25). Order matters: size, then auth, then cooldown (status OR shape), then generic error,
 *  then success. */
function classifyResponse(status: number, body: string): RequestOutcome {
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > MAX_RESPONSE_BYTES) {
    return { kind: 'too_large', bytes };
  }

  if (status === 401 || status === 403) {
    return { kind: 'unauthorized', status };
  }

  const cooldownShaped = COOLDOWN_BODY_PATTERN.test(body);
  if (status === 429 || status === 503 || cooldownShaped) {
    return { kind: 'cooldown', status, retryHint: extractRetryHint(body) };
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
      message: `refused: ${req.host} ${req.method} is not the allowed api.bombfarm.net GET`,
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

/** The one request function (LAR-13). No `node:https`, no `fetch` — the transport is injected. */
export async function requestGet(
  session: ConsentedSession,
  transport: HttpTransport,
  path: string,
  opts?: RequestOptions,
): Promise<RequestOutcome> {
  const req = buildHttpRequest(session, path, opts);
  return sendGet(req, transport);
}
