import type { PremiumPlayingAccount } from '@bombfarm/contracts';
import { createPlayingAccount, type PlayingAccount } from './playing-account.js';

/**
 * The app's one playing-account state. The Premium service is its only writer; when the Premium
 * surface is off for this flavor nothing writes it, so it stays at signed-out and the gate stays
 * closed.
 */
export const appPlayingAccount: PlayingAccount = createPlayingAccount();

/**
 * May premium code run for the game account playing right now? True only while that account is
 * the signed-in user's linked one. No arguments, no I/O: it reads the state the service already
 * derived. Nothing calls it yet — its callers are allowlisted by a guard test.
 */
export function premiumAccountAllows(): boolean {
  return appPlayingAccount.allows();
}

/** Called on every change of the playing-account state, before the change's own caller returns. */
export function onPremiumAccountChange(listener: (next: PremiumPlayingAccount) => void): () => void {
  return appPlayingAccount.subscribe(listener);
}
