import type { AppFlavor, BundlePublicKey, LeasePublicKey } from '@bombfarm/contracts';

/**
 * The one place that knows the test keys and the local-bundle folder variable. It is compiled into
 * dev builds only, reached through `loadDevTrust` and nothing else; a beta or prod bundle has no
 * trace of it, and the packaging gate fails one that does.
 */

/** The environment variable that names a folder holding an unsigned local bundle. */
export const DEV_BUNDLE_DIR_ENV = 'BFC_PREMIUM_DEV_BUNDLE_DIR';

/** The public half of the test keypair that signs the fixture bundle's manifest. */
export const TEST_BUNDLE_PUBLIC_KEY: BundlePublicKey = {
  keyId: '25wFMu0B',
  x: '2Vdp6WURTEhR0e27dvXROYUcDGQkksUQLa_W-LJ88N8',
};

/** The public half of the test keypair that signs Leases for the stub server. */
export const TEST_LEASE_PUBLIC_KEY: LeasePublicKey = {
  keyId: 'gQeWKslZ',
  x: '_roXRDhHYO45U6ZROFd7wPoqq1VFY7hvhbykOyneXLs',
};

export interface DevTrustEnv {
  /** The flavour the app is running as. */
  readonly flavor: AppFlavor;
  /** The process environment the local-bundle folder is read from. */
  readonly vars: Readonly<Record<string, string | undefined>>;
}

export interface DevTrust {
  readonly bundleKeys: readonly BundlePublicKey[];
  readonly leaseKeys: readonly LeasePublicKey[];
  /** The folder named by the environment, or null when it names none. */
  readonly devBundleDir: string | null;
}

/** What a dev-built app trusts beyond the shipped keys; nothing unless it is running as `dev`. */
export function devTrust(env: DevTrustEnv): DevTrust | null {
  if (env.flavor !== 'dev') return null;
  const dir = env.vars[DEV_BUNDLE_DIR_ENV];
  return {
    bundleKeys: [TEST_BUNDLE_PUBLIC_KEY],
    leaseKeys: [TEST_LEASE_PUBLIC_KEY],
    devBundleDir: typeof dir === 'string' && dir.trim() !== '' ? dir : null,
  };
}
