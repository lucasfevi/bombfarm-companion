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
} as const;

export type PremiumPath = keyof typeof PREMIUM_API_PATHS;

export interface PremiumHttpRequest {
  readonly path: PremiumPath;
  readonly method: 'GET' | 'POST';
  readonly token?: string;
  readonly body?: unknown;
}

export interface PremiumHttpResponse {
  readonly status: number;
  readonly body: string;
  readonly retryAfterSec: number | null;
}

export type PremiumHttp = (req: PremiumHttpRequest) => Promise<PremiumHttpResponse>;

const REQUEST_TIMEOUT_MS = 10_000;

function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function createPremiumHttp(origin: string): PremiumHttp {
  return async (req) => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (req.body !== undefined) headers['content-type'] = 'application/json';
    if (req.token !== undefined) headers['authorization'] = `Bearer ${req.token}`;
    const response = await net.fetch(origin + PREMIUM_API_PATHS[req.path], {
      method: req.method,
      headers,
      ...(req.body === undefined ? {} : { body: JSON.stringify(req.body) }),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return {
      status: response.status,
      body: await response.text(),
      retryAfterSec: parseRetryAfter(response.headers.get('retry-after')),
    };
  };
}
