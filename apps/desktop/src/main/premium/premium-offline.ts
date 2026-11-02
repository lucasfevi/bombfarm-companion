import type { FetchBytes, PremiumHttp } from './premium-transport.js';

export const offlinePremiumHttp: PremiumHttp = (req) =>
  Promise.resolve(
    req.path === 'visibility'
      ? { status: 200, body: JSON.stringify({ visible: false }), retryAfterSec: null }
      : { status: 503, body: '', retryAfterSec: null },
  );

export const offlineBytesFetch: FetchBytes = () =>
  Promise.resolve({ status: 503, bytes: new Uint8Array(0), retryAfterSec: null });
