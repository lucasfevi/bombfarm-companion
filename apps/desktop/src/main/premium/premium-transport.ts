import { net } from 'electron';

export const PREMIUM_API_ORIGIN = 'https://api.bombfarm-companion.app';

export const PREMIUM_API_PATHS = {
  signInRequest: '/v1/auth/desktop/requests',
  token: '/v1/auth/desktop/token',
  rotate: '/v1/sessions/rotate',
  signOut: '/v1/sessions/sign-out',
  me: '/v1/me',
  report: '/v1/me/game-account',
  handOff: '/v1/auth/handoff',
  status: '/v1/premium/status',
  visibility: '/v1/premium/visibility',
  licence: '/v1/premium/licence',
  licenceActivate: '/v1/premium/licence/activate',
  lease: '/v1/premium/lease',
  licenceCleanup: '/v1/premium/licence/cleanup',
} as const;

export type PremiumPath = keyof typeof PREMIUM_API_PATHS;

/** The one method a device-signed request uses; the signature covers it. */
export const SIGNED_METHOD = 'POST' as const;

/** The only headers a caller may add: the device signature and the body's content type. */
export interface PremiumExtraHeaders {
  readonly 'BFC-Device'?: string;
  readonly 'content-type'?: string;
}

const ALLOWED_EXTRA_HEADERS: readonly string[] = ['bfc-device', 'content-type'];

export interface PremiumHttpRequest {
  readonly path: PremiumPath;
  readonly method: 'GET' | 'POST';
  readonly token?: string;
  readonly body?: unknown;
  /**
   * A body already serialised, sent byte for byte. A device-signed request signs this exact string,
   * so it must not be serialised a second time. Wins over `body` when both are given.
   */
  readonly rawBody?: string;
  readonly headers?: PremiumExtraHeaders;
}

export interface PremiumHttpResponse {
  readonly status: number;
  readonly body: string;
  readonly retryAfterSec: number | null;
  /** The server's clock from the `Date` header, in epoch ms. Absent when the header is missing or not a date. */
  readonly dateMs?: number;
}

export type PremiumHttp = (req: PremiumHttpRequest) => Promise<PremiumHttpResponse>;

const REQUEST_TIMEOUT_MS = 10_000;

function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function parseDate(value: string | null): number | undefined {
  if (value === null) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

export function createPremiumHttp(origin: string): PremiumHttp {
  return async (req) => {
    const headers: Record<string, string> = { accept: 'application/json' };
    const serialised = req.rawBody ?? (req.body === undefined ? undefined : JSON.stringify(req.body));
    if (serialised !== undefined) headers['content-type'] = 'application/json';
    if (req.token !== undefined) headers['authorization'] = `Bearer ${req.token}`;
    for (const [name, value] of Object.entries(req.headers ?? {})) {
      // The type already limits the names; a cast or a JS caller is stopped here.
      if (!ALLOWED_EXTRA_HEADERS.includes(name.toLowerCase())) throw new Error('premium_header_not_allowed');
      if (typeof value === 'string') headers[name] = value;
    }
    const response = await net.fetch(origin + PREMIUM_API_PATHS[req.path], {
      method: req.method,
      headers,
      ...(serialised === undefined ? {} : { body: serialised }),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const dateMs = parseDate(response.headers.get('date'));
    return {
      status: response.status,
      body: await response.text(),
      retryAfterSec: parseRetryAfter(response.headers.get('retry-after')),
      ...(dateMs === undefined ? {} : { dateMs }),
    };
  };
}
