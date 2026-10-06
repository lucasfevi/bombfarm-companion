import { describe, expect, it } from 'vitest';
import { STRINGS } from '@/shared/i18n';

const BANNED = { en: /\bbags?\b/i, pt: /\bbolsas?\b/i } as const;

function offenders(entries: Record<string, unknown>, banned: RegExp): string[] {
  return Object.entries(entries)
    .filter(([, value]) => typeof value === 'string' && banned.test(value))
    .map(([key]) => key);
}

describe('player-facing copy calls the item storage the inventory', () => {
  it('no English string says bag', () => {
    expect(offenders(STRINGS.en, BANNED.en)).toEqual([]);
  });

  it('no Portuguese string says bolsa', () => {
    expect(offenders(STRINGS.pt, BANNED.pt)).toEqual([]);
  });

  it('red state: the scanner names a string that says bag or bolsa, and passes the real words', () => {
    expect(offenders({ good: 'Not in inventory', bad: 'Not in bag', other: 'Baggage' }, BANNED.en)).toEqual(['bad']);
    expect(offenders({ good: 'Fora do inventário', bad: 'Fora da bolsa', other: 'reembolsa' }, BANNED.pt)).toEqual(['bad']);
  });
});
