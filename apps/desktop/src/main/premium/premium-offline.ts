import type { PremiumHttp } from './premium-transport.js';

export const offlinePremiumHttp: PremiumHttp = (req) =>
  Promise.resolve(
    req.path === 'visibility'
      ? { status: 200, body: JSON.stringify({ visible: false }), retryAfterSec: null }
      : { status: 503, body: '', retryAfterSec: null },
  );
