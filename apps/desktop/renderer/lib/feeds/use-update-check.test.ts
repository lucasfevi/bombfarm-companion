import { describe, expect, it } from 'vitest';
import { disabledUpdateStatus, idleUpdateStatus, type UpdateStatus } from '@bombfarm/contracts';
import { updateCheckRefusal } from './use-update-check';

const stamped = (patch: Partial<UpdateStatus>): UpdateStatus => ({ ...idleUpdateStatus('1.0.0', 'latest'), lastCheckedAt: '2026-09-20T12:00:00.000Z', ...patch });

describe("an update check that came back without checking is the feed's refusal — the press never shows nothing", () => {
  it('a build with no channel (unpackaged, or the dev flavor) is refused as updates being off', () => {
    expect(updateCheckRefusal(disabledUpdateStatus('1.0.0'))).toBe('updates_off');
  });

  it('a download in flight, or an update waiting for a restart, is refused as already on its way', () => {
    expect(updateCheckRefusal(stamped({ phase: 'downloading', percent: 40 }))).toBe('updates_busy');
    expect(updateCheckRefusal(stamped({ phase: 'ready' }))).toBe('updates_busy');
  });

  it('an updater that never loaded — error with no check ever stamped — is unavailable', () => {
    expect(updateCheckRefusal({ ...idleUpdateStatus('1.0.0', 'latest'), phase: 'error', error: 'unknown' })).toBe('unavailable');
  });

  it('a check that ran is not a refusal, whatever it found', () => {
    expect(updateCheckRefusal(stamped({ phase: 'not-available' }))).toBeNull();
    expect(updateCheckRefusal(stamped({ phase: 'available', availableVersion: '1.1.0' }))).toBeNull();
    expect(updateCheckRefusal(stamped({ phase: 'error', error: 'offline' }))).toBeNull();
  });
});
