/**
 * `skills.totals.xp_mult` -> `account.tree.xpMult`, mirroring exactly how `coin_add` maps to
 * `teamCoinPct` on the line above it in `mapAccountData` (`import-save.ts`). Unlike `teamCoinPct`,
 * `xpMult` is a straight multiplier (not `x * 100`). A zero or negative one is no real account's
 * state, so it is withheld (`null`) rather than read as 0 or invented as 1.
 */
import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { skillTotals } from './helpers/skill-totals';

function accountWithTotals(totals: Record<string, unknown>) {
  const { account } = parseSaveFile(
    { heroes: [], skills: { refunds: {}, totals: skillTotals(totals) } },
    [],
  );
  return account;
}

describe('import-save — skills.totals.xp_mult -> account.tree.xpMult', () => {
  it('a finite xp_mult is carried through verbatim (not scaled by 100, unlike teamCoinPct)', () => {
    const account = accountWithTotals({ xp_mult: 1.56 });
    expect(account.tree?.xpMult).toBe(1.56);
  });

  it('an absent xp_mult makes the whole tree unavailable instead of defaulting to no boost', () => {
    expect(accountWithTotals({ xp_mult: undefined }).tree).toBeNull();
  });

  it('xp_mult: 0 or below withholds the multiplier and keeps the rest of the tree', () => {
    for (const xp_mult of [0, -1]) {
      const account = accountWithTotals({ xp_mult });
      expect(account.tree).not.toBeNull();
      expect(account.tree?.xpMult).toBeNull();
    }
  });

  it('a non-finite xp_mult (NaN, string, null) makes the tree unavailable', () => {
    expect(accountWithTotals({ xp_mult: Number.NaN }).tree).toBeNull();
    expect(accountWithTotals({ xp_mult: '1.56' }).tree).toBeNull();
    expect(accountWithTotals({ xp_mult: null }).tree).toBeNull();
  });
});
