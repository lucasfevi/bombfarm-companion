import { describe, expect, it } from 'vitest';
import type { AccountPayload } from '@bombfarm/contracts';
import { parseAccountPayload, passActive } from '@bombfarm/domain/import-save';

function vipUntilOf(account: unknown): number | null | undefined {
  const payload = { heroes: [], account } as unknown as AccountPayload;
  return parseAccountPayload(payload, []).account.vipUntil;
}

const NOW_MS = Date.UTC(2026, 9, 7, 12, 0, 0);
const NOW_S = NOW_MS / 1000;

describe('vip_until on the mapped account', () => {
  it('carries a future expiry, a past expiry and zero verbatim, in seconds', () => {
    expect(vipUntilOf({ vip_until: NOW_S + 3600 })).toBe(NOW_S + 3600);
    expect(vipUntilOf({ vip_until: NOW_S - 3600 })).toBe(NOW_S - 3600);
    expect(vipUntilOf({ vip_until: 0 })).toBe(0);
  });

  it('is null when the key is absent, non-numeric, or there is no account block', () => {
    expect(vipUntilOf({})).toBeNull();
    expect(vipUntilOf({ vip_until: '1790000000' })).toBeNull();
    expect(vipUntilOf(undefined)).toBeNull();
  });
});

describe('passActive', () => {
  it.each([
    ['a future expiry', NOW_S + 1, true],
    ['an expiry that is exactly now', NOW_S, false],
    ['a past expiry', NOW_S - 1, false],
    ['never owned (0)', 0, false],
    ['absent (null)', null, false],
    ['undefined', undefined, false],
    ['a non-finite value', Number.NaN, false],
  ])('%s -> %s', (_label, vipUntil, expected) => {
    expect(passActive(vipUntil, NOW_MS)).toBe(expected);
  });
});
