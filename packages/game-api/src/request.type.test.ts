/**
 * Compile-time assertions for `HttpRequest`'s literal host/method (the one-host/HTTPS/GET-only
 * invariant). Enforced only by
 * `pnpm --filter @bombfarm/game-api typecheck:tests` — see `session.type.test.ts` for why.
 */
import { describe, expect, it } from 'vitest';
import type { HttpRequest } from './request.js';

describe('request.ts — type-level assertions', () => {
  it('a request with the trusted host and method is constructible', () => {
    const req: HttpRequest = {
      host: 'api.bombfarm.net',
      method: 'GET',
      path: '/state',
      headers: {},
      timeoutMs: 15_000,
    };
    expect(req.host).toBe('api.bombfarm.net');
  });
});

// --- Compile-time-only assertions below: no runtime behaviour, enforced by `tsc` only. ---

const _wrongHost: HttpRequest = {
  // @ts-expect-error - HttpRequest.host is the literal 'api.bombfarm.net'; no other host is expressible
  host: 'evil.example.net',
  method: 'GET',
  path: '/state',
  headers: {},
  timeoutMs: 15_000,
};

const _wrongMethod: HttpRequest = {
  host: 'api.bombfarm.net',
  // @ts-expect-error - HttpRequest.method is the literal 'GET'; no write method is expressible
  method: 'POST',
  path: '/state',
  headers: {},
  timeoutMs: 15_000,
};
