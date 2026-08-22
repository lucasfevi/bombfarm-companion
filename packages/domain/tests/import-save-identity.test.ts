import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';

/**
 * `account.player_name` / `account.account_id` are `allowance` keys on the export fingerprint —
 * a real export carries them and the committed corpus has them scrubbed, so every value below is
 * INVENTED. Never paste a real capture's name or id into this file.
 */
const identity = (account: Record<string, unknown>) =>
  parseAccountPayload({ heroes: [], account }, []).account;

describe('save identity (player_name / account_id)', () => {
  it('reads both off the account section', () => {
    const a = identity({ player_name: 'Tester', account_id: 1 });
    expect(a.playerName).toBe('Tester');
    expect(a.accountId).toBe('1');
  });

  it('renders a numeric id as a plain string, never rounded or exponent-formatted', () => {
    // Exports serialise the id as a JSON number (`486.0` parses to `486`), but it identifies an
    // account rather than counting anything, so it is carried as text from the boundary in.
    expect(identity({ account_id: 486 }).accountId).toBe('486');
    expect(identity({ account_id: 20000000000000000000 }).accountId).not.toContain('e');
  });

  it('treats a blank or whitespace-only name as absent, not as an empty label', () => {
    expect(identity({ player_name: '   ' }).playerName).toBeNull();
    expect(identity({ player_name: '' }).playerName).toBeNull();
  });

  it('trims surrounding whitespace off a real name', () => {
    expect(identity({ player_name: '  Tester  ' }).playerName).toBe('Tester');
  });

  it('is null on a scrubbed section, and on a payload with no account section at all', () => {
    const scrubbed = identity({ phase: 1, max_phase: 2 });
    expect(scrubbed.playerName).toBeNull();
    expect(scrubbed.accountId).toBeNull();

    const none = parseAccountPayload({ heroes: [] }, []).account;
    expect(none.playerName).toBeNull();
    expect(none.accountId).toBeNull();
  });

  it('rejects a non-finite or wrong-typed id rather than printing NaN', () => {
    expect(identity({ account_id: Number.NaN }).accountId).toBeNull();
    expect(identity({ account_id: {} }).accountId).toBeNull();
    expect(identity({ player_name: 42 }).playerName).toBeNull();
  });
});
