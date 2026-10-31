import { describe, expect, it } from 'vitest';
import { createStatusCapability } from './status.js';

describe('the premium.status capability', () => {
  it('answers exactly the five fields', () => {
    const status = createStatusCapability({
      premiumStatus: () => ({ active: true, until: '2026-12-01T00:00:00.000Z' }),
      audience: () => 'tester',
    });

    expect(status({})).toEqual({
      active: true,
      until: '2026-12-01T00:00:00.000Z',
      paused: false,
      pausedReason: null,
      audience: 'tester',
    });
  });

  it('answers inactive with no end before the app has any answer', () => {
    const status = createStatusCapability({ premiumStatus: () => null, audience: () => 'owner' });

    expect(status(undefined)).toEqual({
      active: false,
      until: null,
      paused: false,
      pausedReason: null,
      audience: 'owner',
    });
  });

  it('reads an unknown audience as public', () => {
    const status = createStatusCapability({ premiumStatus: () => null, audience: () => null });

    expect((status(null) as { audience: string }).audience).toBe('public');
  });

  it('carries nothing beyond the five fields, whatever the app holds', () => {
    const held = { active: true, until: null, accountId: 'acct-marker', token: 'tok-marker' };
    const status = createStatusCapability({ premiumStatus: () => held, audience: () => 'public' });

    const answer = status({}) as Record<string, unknown>;
    expect(Object.keys(answer).sort()).toEqual(['active', 'audience', 'paused', 'pausedReason', 'until']);
    expect(JSON.stringify(answer)).not.toContain('marker');
  });
});
