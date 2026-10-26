import { describe, expect, it } from 'vitest';
import { createPlayingAccount } from './playing-account.js';
import { appPlayingAccount, onPremiumAccountChange, premiumAccountAllows } from './playing-account-gate.js';

describe('playing-account state holder', () => {
  it('starts at unknown, signed out, and does not allow', () => {
    const playing = createPlayingAccount();

    expect(playing.current()).toEqual({ state: 'unknown', reason: 'signed_out' });
    expect(playing.allows()).toBe(false);
  });

  it('allows only while linked', () => {
    const playing = createPlayingAccount();

    playing.set({ state: 'linked', reason: null });
    expect(playing.allows()).toBe(true);
    playing.set({ state: 'other', reason: 'other_account' });
    expect(playing.allows()).toBe(false);
    playing.set({ state: 'unknown', reason: 'checking' });
    expect(playing.allows()).toBe(false);
  });

  it('tells every subscriber before set returns, and only on a real change', () => {
    const playing = createPlayingAccount();
    const seen: string[] = [];
    playing.subscribe((next) => seen.push(`a:${next.state}/${String(next.reason)}`));
    const stop = playing.subscribe((next) => seen.push(`b:${next.state}/${String(next.reason)}`));

    playing.set({ state: 'unknown', reason: 'checking' });
    expect(seen).toEqual(['a:unknown/checking', 'b:unknown/checking']);
    playing.set({ state: 'unknown', reason: 'checking' });
    expect(seen).toHaveLength(2);
    playing.set({ state: 'unknown', reason: 'report_failed' });
    expect(seen).toHaveLength(4);

    stop();
    playing.set({ state: 'linked', reason: null });
    expect(seen).toEqual([
      'a:unknown/checking',
      'b:unknown/checking',
      'a:unknown/report_failed',
      'b:unknown/report_failed',
      'a:linked/null',
    ]);
  });
});

describe('a subscriber that throws', () => {
  it('neither stops the change nor the other subscribers', () => {
    const playing = createPlayingAccount();
    const seen: string[] = [];
    playing.subscribe(() => {
      throw new Error('subscriber fault');
    });
    playing.subscribe((next) => seen.push(next.state));

    expect(() => {
      playing.set({ state: 'linked', reason: null });
    }).not.toThrow();
    expect(playing.current()).toEqual({ state: 'linked', reason: null });
    expect(seen).toEqual(['linked']);
  });
});

describe('the app gate', () => {
  it('takes no arguments and answers from the app state', () => {
    expect(premiumAccountAllows.length).toBe(0);
    const before = appPlayingAccount.current();
    try {
      appPlayingAccount.set({ state: 'unknown', reason: 'signed_out' });
      expect(premiumAccountAllows()).toBe(false);
      appPlayingAccount.set({ state: 'linked', reason: null });
      expect(premiumAccountAllows()).toBe(true);
      appPlayingAccount.set({ state: 'other', reason: 'no_steam_link' });
      expect(premiumAccountAllows()).toBe(false);
    } finally {
      appPlayingAccount.set(before);
    }
  });

  it('notifies subscribers with the new state and reason on every change', () => {
    const before = appPlayingAccount.current();
    const seen: unknown[] = [];
    const stop = onPremiumAccountChange((next) => seen.push(next));
    try {
      appPlayingAccount.set({ state: 'linked', reason: null });
      appPlayingAccount.set({ state: 'unknown', reason: 'checking' });
      expect(seen).toEqual([
        { state: 'linked', reason: null },
        { state: 'unknown', reason: 'checking' },
      ]);
    } finally {
      stop();
      appPlayingAccount.set(before);
    }
  });
});
