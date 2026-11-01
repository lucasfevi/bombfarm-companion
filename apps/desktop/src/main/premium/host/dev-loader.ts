import type { LocalBundleContext, LocalBundleResult } from './dev-bundle.js';
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

/**
 * Reads the local development bundle in `dir`, in a dev build only. The same compile-time branch
 * as `loadDevTrust`: a beta or prod bundle has no reader for it, and so no way to load one.
 */
export async function loadLocalBundle(dir: string, ctx: LocalBundleContext): Promise<LocalBundleResult | null> {
  if (__BFC_PREMIUM_DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readLocalBundle } = require('./dev-bundle') as typeof import('./dev-bundle.js');
    return readLocalBundle(dir, ctx);
  }
  return Promise.resolve(null);
}
