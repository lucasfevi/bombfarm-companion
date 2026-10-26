import { signedOutPlayingAccount, type PremiumPlayingAccount } from '@bombfarm/contracts';

export type PlayingAccountListener = (next: PremiumPlayingAccount) => void;

/**
 * Whether the game account playing right now is the signed-in user's linked one. Held in memory
 * only — a value carried over a restart could vouch for a session that has changed since — and
 * written by the Premium service alone. `set` tells every subscriber before it returns, so a drop
 * out of `linked` is known in the same tick as the change that caused it.
 */
export interface PlayingAccount {
  current(): PremiumPlayingAccount;
  set(next: PremiumPlayingAccount): void;
  allows(): boolean;
  subscribe(listener: PlayingAccountListener): () => void;
}

export function createPlayingAccount(): PlayingAccount {
  let value: PremiumPlayingAccount = signedOutPlayingAccount;
  const listeners = new Set<PlayingAccountListener>();

  return {
    current: () => value,
    set(next) {
      if (next.state === value.state && next.reason === value.reason) return;
      value = next;
      for (const listener of [...listeners]) listener(next);
    },
    allows: () => value.state === 'linked',
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
