import { describe, expect, it } from 'vitest';
import { pickHeroAfterImportOrStrongest } from '@/app/_shell/app-shell-inner';
import type { HeroRecord } from '@/shared/lib/storage';

function hero(id: string, power: number): HeroRecord {
  return { id, name: id, updatedAt: 0, power } as HeroRecord;
}

/**
 * The shell's own half of the import contract. `pickHeroAfterImport` returning `null` is correct
 * — the hero being edited really is gone — but the shell must not leave `activeHeroId` pointing
 * at it, because the draft autosave then has nothing valid to write and declines silently.
 */
describe('pickHeroAfterImportOrStrongest', () => {
  const merged = [hero('a', 100), hero('b', 200)];

  it('keeps the hero being edited when the import still carries it', () => {
    expect(pickHeroAfterImportOrStrongest(merged, 'a')?.id).toBe('a');
  });

  it('falls back to the strongest hero when the import replaced the account', () => {
    expect(pickHeroAfterImportOrStrongest(merged, 'from-another-account')?.id).toBe('b');
  });

  it('uses the strongest hero when nothing was being edited', () => {
    expect(pickHeroAfterImportOrStrongest(merged, null)?.id).toBe('b');
  });

  it('answers null only when the roster is genuinely empty', () => {
    expect(pickHeroAfterImportOrStrongest([], 'from-another-account')).toBeNull();
    expect(pickHeroAfterImportOrStrongest([], null)).toBeNull();
  });
});
