import { describe, expect, it } from 'vitest';
import type { PremiumLicenceView } from './premium-licence.js';

type Allowed =
  | 'state'
  | 'reason'
  | 'holderName'
  | 'lastMoveAt'
  | 'nextMoveAt'
  | 'moveInFlight'
  | 'moveFailed'
  | 'removalDone';

/** Resolves to `true` only when the view's keys are exactly the allowed ones. */
type ExactKeys<T> = [Exclude<keyof T, Allowed>, Exclude<Allowed, keyof T>] extends [never, never] ? true : never;

const viewKeysAreExact: ExactKeys<PremiumLicenceView> = true;

describe('the licence view carries only the approved fields', () => {
  it('has exactly the approved keys', () => {
    expect(viewKeysAreExact).toBe(true);
  });

  it('would fail to compile if a key, id, device id or SteamID field were added', () => {
    // @ts-expect-error a view with a keyId field is not the approved shape
    const withKeyId: ExactKeys<PremiumLicenceView & { keyId: string }> = true;
    // @ts-expect-error a view with a deviceId field is not the approved shape
    const withDeviceId: ExactKeys<PremiumLicenceView & { deviceId: string }> = true;
    // @ts-expect-error a view with a steamId64 field is not the approved shape
    const withSteamId: ExactKeys<PremiumLicenceView & { steamId64: string }> = true;
    expect([withKeyId, withDeviceId, withSteamId]).toEqual([true, true, true]);
  });

  it('would fail to compile if an approved field were dropped', () => {
    // @ts-expect-error a view missing moveFailed is not the approved shape
    const missing: ExactKeys<Omit<PremiumLicenceView, 'moveFailed'>> = true;
    expect(missing).toBe(true);
  });
});
