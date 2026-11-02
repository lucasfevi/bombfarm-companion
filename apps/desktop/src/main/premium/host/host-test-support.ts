import { PLUGIN_API_VERSION } from '@bombfarm/contracts';
import { TEST_BUNDLE_KEYPAIR } from '../../../../tests/fixtures/premium/keys.mjs';
import { signFixture, type FixtureOptions } from '../../../../tests/fixtures/premium/sign-fixture.mjs';
import type { SqliteDb } from '../../storage/index.js';
import { createBundleKeyTable, verifyBundle, type BundleInput, type VerifiedBundle, type VerifyContext } from './bundle-verify.js';

/** Shared by the host's tests: a signed fixture, the context that accepts it, and small fakes. */

export const HOST_NOW = Date.parse('2026-11-01T12:00:00.000Z');
export const HOST_CREATED = '2026-11-01T00:00:00.000Z';
export const TEST_KEYS = createBundleKeyTable([{ keyId: TEST_BUNDLE_KEYPAIR.keyId, x: TEST_BUNDLE_KEYPAIR.x }]);

export const VERIFY_CTX: VerifyContext = {
  keys: TEST_KEYS,
  highest: null,
  floor: 0,
  nowMs: HOST_NOW,
  hostApi: PLUGIN_API_VERSION,
  appVersion: '1.0.0',
  flavor: 'dev',
};

export function signedInput(options: FixtureOptions = {}): BundleInput {
  return signFixture({ sequence: 4, createdAt: HOST_CREATED, ...options });
}

export function verifiedFixture(options: FixtureOptions = {}): VerifiedBundle {
  const result = verifyBundle(signedInput(options), VERIFY_CTX);
  if (!result.ok) throw new Error(`the fixture was refused: ${result.reason}`);
  return result.bundle;
}

/** An account_meta table in memory: just enough of the statement API for the host's one row. */
export function createMetaDb(): SqliteDb & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    exec: () => undefined,
    close: () => undefined,
    prepare() {
      const statement = {
        get: (key: string) => (rows.has(key) ? { value: rows.get(key) } : undefined),
        run: (key: string, value?: string) => {
          // The delete statement binds one parameter, the upsert two.
          if (value === undefined) rows.delete(key);
          else rows.set(key, value);
          return { changes: 1 };
        },
        all: () => [],
      };
      return statement;
    },
  };
}
