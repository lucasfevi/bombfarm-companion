import { describe, expect, it } from 'vitest';
import type { PremiumManifest } from './premium-host.js';

type Allowed =
  | 'schema'
  | 'keyId'
  | 'bundle'
  | 'version'
  | 'sequence'
  | 'createdAt'
  | 'expiresAt'
  | 'hostApi'
  | 'minAppVersion'
  | 'flavors'
  | 'capabilities'
  | 'files';

/** Resolves to `true` only when the manifest's keys are exactly the contract's fields. */
type ExactKeys<T> = [Exclude<keyof T, Allowed>, Exclude<Allowed, keyof T>] extends [never, never] ? true : never;

const manifestKeysAreExact: ExactKeys<PremiumManifest> = true;

describe('the bundle manifest carries exactly the contract fields', () => {
  it('has exactly the contract keys', () => {
    expect(manifestKeysAreExact).toBe(true);
  });

  it('would fail to compile if a field were added', () => {
    // @ts-expect-error a manifest with an extra field is not the contract shape
    const extra: ExactKeys<PremiumManifest & { entry: string }> = true;
    expect(extra).toBe(true);
  });

  it('would fail to compile if a field were dropped', () => {
    // @ts-expect-error a manifest missing expiresAt is not the contract shape
    const missing: ExactKeys<Omit<PremiumManifest, 'expiresAt'>> = true;
    expect(missing).toBe(true);
  });
});
