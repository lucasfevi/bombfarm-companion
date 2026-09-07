import type { AccountReadRefusal } from '@bombfarm/contracts';
import type { Copy } from './copy';

/**
 * Why a press that asked the app to go and read the account started no read, in the player's
 * terms. Shared by every screen that offers such a press, so one condition cannot come out in two
 * wordings depending on which button the player happened to reach for.
 *
 * The floor is deliberately not a number of milliseconds: what the player can act on is that the
 * read is already as fresh as the app will make it, not how long is left on a timer they never saw
 * start.
 *
 * The last two keep their forge names because they are the same sentences the forge start path
 * already prints for the same two conditions, and a second key would be a second sentence to keep
 * in step with the first.
 */
export function accountReadRefusalText(reason: AccountReadRefusal, t: Copy): string {
  switch (reason) {
    case 'rate_limited':
      return t.accountReadRecent;
    case 'offline':
      return t.accountReadFixture;
    case 'not_consented':
      return t.accountReadNotConsented;
    case 'game_not_running':
      return t.accountReadGameNotRunning;
    case 'token_unavailable':
      return t.forgeStartTokenUnavailable;
    case 'unavailable':
      return t.forgeStartUnavailable;
  }
}
