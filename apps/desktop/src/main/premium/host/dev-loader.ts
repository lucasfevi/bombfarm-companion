import type { DevTrust, DevTrustEnv } from './dev-trust.js';

/**
 * The only way into the dev-only trust module. The branch is a build-time constant, so a beta or
 * prod bundle drops the `require` — and with it the module — instead of shipping it unused.
 */
export function loadDevTrust(env: DevTrustEnv): DevTrust | null {
  if (__BFC_PREMIUM_DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { devTrust } = require('./dev-trust') as typeof import('./dev-trust.js');
    return devTrust(env);
  }
  return null;
}
