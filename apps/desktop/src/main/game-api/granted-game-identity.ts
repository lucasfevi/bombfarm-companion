import type { UsagePingAccount } from '@bombfarm/contracts';
import { isGranted, type ConsentRecord, type GrantedConsent } from '@bombfarm/game-api';
import type { GameIdentity } from './session-token-file.js';

export interface NamedGameIdentity extends GameIdentity {
  readonly playerName: string | null;
}

export function createGrantedGameIdentityReader(deps: {
  readonly readConsent: () => ConsentRecord;
  readonly readIdentity: (consent: GrantedConsent) => GameIdentity | null;
  readonly readAccount: () => UsagePingAccount | null;
}): () => NamedGameIdentity | null {
  return () => {
    const consent = deps.readConsent();
    if (!isGranted(consent)) return null;
    const identity = deps.readIdentity(consent);
    if (identity === null) return null;
    const account = deps.readAccount();
    const playerName = account !== null && account.id === identity.accountId ? account.name : null;
    return { ...identity, playerName };
  };
}
