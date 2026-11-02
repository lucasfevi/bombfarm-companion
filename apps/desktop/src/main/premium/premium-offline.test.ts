import { describe, expect, it } from 'vitest';
import { PREMIUM_API_PATHS, type PremiumPath } from './premium-transport.js';
import { offlineBytesFetch, offlinePremiumHttp } from './premium-offline.js';

describe('the offline premium transport', () => {
  it('answers the visibility check with a hidden tab', async () => {
    const response = await offlinePremiumHttp({ path: 'visibility', method: 'GET' });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ visible: false });
  });

  it.each((Object.keys(PREMIUM_API_PATHS) as PremiumPath[]).filter((path) => path !== 'visibility'))(
    'answers %s with an empty 503',
    async (path) => {
      const response = await offlinePremiumHttp({ path, method: 'POST', token: 'token-fixture', body: {} });

      expect(response).toEqual({ status: 503, body: '', retryAfterSec: null });
    },
  );
});

describe('the offline bytes transport', () => {
  it('answers every bundle route with an empty 503', async () => {
    const reply = await offlineBytesFetch({
      route: { r: 'file', sequence: 1, path: 'ui/index.js' },
      token: 'token-fixture',
      device: 'key.1.sig',
      maxBytes: 10,
      signal: new AbortController().signal,
    });

    expect(reply).toEqual({ status: 503, bytes: new Uint8Array(0), retryAfterSec: null });
  });
});
