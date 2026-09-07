import type { AccountReadResult, AccountSource, ConsentRecord } from '@bombfarm/contracts';
import { isGranted, type GrantedConsent } from '@bombfarm/game-api';
import type { SessionTokenFileResult } from './session-token-file.js';
import type { TriggeredRefresh } from './triggered-refresh.js';

/**
 * What answers a player asking for a read right now. The gates below are the account cycle's own,
 * in the cycle's own order, asked before a read is started rather than discovered inside one: a
 * cycle that cannot read commits nothing and raises no event, so a screen waiting on it would wait
 * forever with nothing to show for the press.
 */

export interface AccountReadRequestDeps {
  readonly consentStore: { read(): ConsentRecord };
  readonly accountSource: () => AccountSource;
  readonly isGameRunning: () => boolean;
  readonly readToken: (consent: GrantedConsent) => SessionTokenFileResult;
  /** Read through a function because it is built during boot, after the IPC handlers exist. */
  readonly triggeredRefresh: () => TriggeredRefresh | null;
}

export function requestAccountRead(deps: AccountReadRequestDeps): AccountReadResult {
  if (deps.accountSource() === 'fixture') return { ok: false, reason: 'offline' };

  const consent = deps.consentStore.read();
  if (!isGranted(consent)) return { ok: false, reason: 'not_consented' };
  if (!deps.isGameRunning()) return { ok: false, reason: 'game_not_running' };
  if (!deps.readToken(consent).ok) return { ok: false, reason: 'token_unavailable' };

  const trigger = deps.triggeredRefresh();
  if (trigger === null) return { ok: false, reason: 'unavailable' };
  return trigger.notify() ? { ok: true } : { ok: false, reason: 'rate_limited' };
}
