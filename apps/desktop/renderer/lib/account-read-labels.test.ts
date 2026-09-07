import { describe, expect, it } from 'vitest';
import type { AccountReadRefusal } from '@bombfarm/contracts';
import { en } from './copy/en';
import { ptBR } from './copy/pt-BR';
import { accountReadRefusalText } from './account-read-labels';

describe('accountReadRefusalText', () => {
  const REASONS: AccountReadRefusal[] = [
    'rate_limited',
    'offline',
    'not_consented',
    'game_not_running',
    'token_unavailable',
    'unavailable',
  ];

  it('has words for every reason a read can be refused, in both locales', () => {
    for (const reason of REASONS) {
      expect(accountReadRefusalText(reason, en).length, `en is silent about ${reason}`).toBeGreaterThan(0);
      expect(accountReadRefusalText(reason, ptBR).length, `pt-BR is silent about ${reason}`).toBeGreaterThan(0);
      expect(accountReadRefusalText(reason, ptBR)).not.toBe(accountReadRefusalText(reason, en));
    }
  });

  it('tells the floor apart from the four reasons a read cannot happen at all', () => {
    expect(accountReadRefusalText('rate_limited', en)).toBe(en.accountReadRecent);
    expect(accountReadRefusalText('offline', en)).toBe(en.accountReadFixture);
    expect(accountReadRefusalText('not_consented', en)).toBe(en.accountReadNotConsented);
    expect(accountReadRefusalText('game_not_running', en)).toBe(en.accountReadGameNotRunning);
    expect(accountReadRefusalText('token_unavailable', en)).toBe(en.forgeStartTokenUnavailable);
    expect(accountReadRefusalText('unavailable', en)).toBe(en.forgeStartUnavailable);
  });

  it('says the floor in plain words rather than however many milliseconds are left on it', () => {
    expect(accountReadRefusalText('rate_limited', en)).not.toMatch(/\d/);
    expect(accountReadRefusalText('rate_limited', ptBR)).not.toMatch(/\d/);
  });

  // Two screens print these, so a line naming one screen's subject is wrong on the other. The
  // wording that had to go was the Forge's bag, once the Farm board started printing them too.
  it("names no single screen’s subject, in either locale", () => {
    for (const reason of REASONS) {
      expect(accountReadRefusalText(reason, en).toLowerCase()).not.toContain('bag');
      expect(accountReadRefusalText(reason, ptBR).toLowerCase()).not.toContain('mochila');
    }
  });
});
