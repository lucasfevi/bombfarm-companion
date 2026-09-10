/**
 * What the Heroes screen has to draw, decided once from the account seam's own state.
 *
 * The two empty answers are the reason this is a function rather than a chain of ternaries in the
 * view. "Nothing has been read from your account yet" and "this account owns no heroes" are
 * different facts, and collapsing them tells a player who has not opened the game that they own
 * nothing — the one sentence this screen must never print without evidence.
 */
import type { AccountViewState } from '../../lib/account/account-view-store';
import { buildAccountRoster, type AccountRoster } from '../../lib/account/account-roster';
import { capturedAtOf } from '../../lib/account/account-facts';
import { orderByRollQuality, type RosterHeroRow } from './hero-roster-order';

export type HeroesScreenModel =
  | { readonly kind: 'loading' }
  | { readonly kind: 'bridgeUnavailable' }
  /** The raw message from main is untranslatable English — diagnostic data, never player copy. */
  | { readonly kind: 'readFailed'; readonly message: string }
  | { readonly kind: 'neverRead' }
  | { readonly kind: 'noHeroes' }
  | {
      readonly kind: 'roster';
      readonly roster: AccountRoster;
      /** Non-empty by construction — an empty roster is {@link HeroesScreenModel}'s `noHeroes`
       *  arm, so the screen below never has to hold "a list with nothing selected in it". */
      readonly rows: readonly [RosterHeroRow, ...RosterHeroRow[]];
    };

export function heroesScreenModel(account: AccountViewState): HeroesScreenModel {
  if (account.status === 'loading') return { kind: 'loading' };
  if (account.status === 'bridge-unavailable') return { kind: 'bridgeUnavailable' };
  if (account.status === 'error') return { kind: 'readFailed', message: account.message };

  const roster = buildAccountRoster(account.view);
  // A payload nothing could be parsed out of is not an account with no heroes on it.
  if (roster === null) return { kind: 'neverRead' };

  // The heroes section's own capture time is the evidence. Absent, nobody has asked the game for
  // the roster yet, and an empty array is the absence of an answer rather than an answer of zero.
  if (capturedAtOf(account.view.payload, 'heroes') === null) return { kind: 'neverRead' };

  const [first, ...rest] = orderByRollQuality(roster.heroes);
  if (first === undefined) return { kind: 'noHeroes' };

  return { kind: 'roster', roster, rows: [first, ...rest] };
}
