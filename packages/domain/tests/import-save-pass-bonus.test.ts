import { describe, expect, it } from 'vitest';
import type { AccountPayload } from '@bombfarm/contracts';
import { parseAccountPayload } from '@bombfarm/domain/import-save';

function passBonusOf(account: unknown) {
  const payload = { heroes: [], account } as unknown as AccountPayload;
  return parseAccountPayload(payload, []).account.passBonus;
}

describe('the Pass Bonus on the mapped account', () => {
  it('carries the expiry in seconds and the gold and XP adds as the wire states them', () => {
    expect(passBonusOf({ bonus_passe_ate: 1_792_809_003, bonus_passe_ouro: 0.25, bonus_passe_xp: 0.15 })).toEqual({
      until: 1_792_809_003,
      gold: 0.25,
      xp: 0.15,
    });
  });

  it('is null unless all three keys are numbers, or when there is no account block', () => {
    expect(passBonusOf({})).toBeNull();
    expect(passBonusOf({ bonus_passe_ate: 1_792_809_003, bonus_passe_ouro: 0.25 })).toBeNull();
    expect(passBonusOf({ bonus_passe_ate: '1792809003', bonus_passe_ouro: 0.25, bonus_passe_xp: 0.15 })).toBeNull();
    expect(passBonusOf(undefined)).toBeNull();
  });
});
