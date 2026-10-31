import { net } from 'electron';
import type { AppFlavor } from '@bombfarm/contracts';
import { checkBundlePath } from './host/bundle-paths.js';

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

/** The method the licence routes are signed with; the signature covers it. */
export const SIGNED_METHOD = 'POST' as const;
/** The method a bundle route is signed with. */
export const SIGNED_GET_METHOD = 'GET' as const;
export type SignedMethod = typeof SIGNED_METHOD | typeof SIGNED_GET_METHOD;

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

const FILE_TIMEOUT_MS = 30_000;
const BUNDLE_PATH = '/v1/premium/bundle';

/** A route the Premium bundle is served on: the manifest answer, or one file of a sequence. */
export type BundleRoute =
  | { readonly r: 'bundle'; readonly query: { readonly hostApi: string; readonly appVersion: string; readonly flavor: AppFlavor } }
  | { readonly r: 'file'; readonly sequence: number; readonly path: string };

/**
 * The URL pathname of a route, which is exactly what a device signature covers (the query string
 * is not part of it). A file's path is joined as it is, never percent-encoded, so the pathname the
 * server hashes is the one signed.
 */
export function bundleRoutePath(route: BundleRoute): string {
  if (route.r === 'bundle') return BUNDLE_PATH;
  if (!Number.isInteger(route.sequence) || route.sequence < 1 || checkBundlePath(route.path) !== 'ok') {
    throw new Error('premium_bundle_route_invalid');
  }
  return `${BUNDLE_PATH}/${String(route.sequence)}/files/${route.path}`;
}

function bundleRouteSearch(route: BundleRoute): string {
  if (route.r !== 'bundle') return '';
  const { hostApi, appVersion, flavor } = route.query;
  return `?${new URLSearchParams({ hostApi, appVersion, flavor }).toString()}`;
}

export interface BytesRequest {
  readonly route: BundleRoute;
  readonly token: string;
  /** The `BFC-Device` header value, already signed for this route's pathname. */
  readonly device: string;
  /** The most bytes the body may hold; a longer one aborts the transfer. */
  readonly maxBytes: number;
  readonly signal: AbortSignal;
}

export interface BytesResponse {
  readonly status: number;
  readonly bytes: Uint8Array;
  readonly retryAfterSec: number | null;
  readonly dateMs?: number;
}

export type FetchBytes = (req: BytesRequest) => Promise<BytesResponse>;

/** Thrown when a body is longer than the request allowed; nothing of it is kept. */
export class BytesTooLargeError extends Error {
  constructor() {
    super('premium_bytes_too_large');
    this.name = 'BytesTooLargeError';
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = response.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    await response.body?.cancel();
    throw new BytesTooLargeError();
  }
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = (await reader.read()) as { done: boolean; value?: Uint8Array };
    const value = step.value;
    if (step.done || value === undefined) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BytesTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/**
 * Fetches one bundle route as raw bytes: `GET`, no HTTP cache, no redirects, the body streamed and
 * cut off past `maxBytes`. The bearer token and the device header are the only headers sent.
 */
export async function fetchBytes(origin: string, req: BytesRequest): Promise<BytesResponse> {
  const timeoutMs = req.route.r === 'file' ? FILE_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  // `cache` is a documented fetch option that the bundled request type does not list, so the
  // init is typed on its own; `net.fetch` reads it (checked against the pinned Electron).
  const init: RequestInit & { cache: 'no-store' } = {
    method: 'GET',
    headers: {
      accept: 'application/octet-stream, application/json',
      authorization: `Bearer ${req.token}`,
      'BFC-Device': req.device,
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(timeoutMs)]),
  };
  const response = await net.fetch(origin + bundleRoutePath(req.route) + bundleRouteSearch(req.route), init);
  const dateMs = parseDate(response.headers.get('date'));
  return {
    status: response.status,
    bytes: await readCapped(response, req.maxBytes),
    retryAfterSec: parseRetryAfter(response.headers.get('retry-after')),
    ...(dateMs === undefined ? {} : { dateMs }),
  };
}

export function createBytesFetch(origin: string): FetchBytes {
  return (req) => fetchBytes(origin, req);
}
