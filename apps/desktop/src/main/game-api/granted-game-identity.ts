import { isGranted, type ConsentRecord, type GrantedConsent } from '@bombfarm/game-api';
import type { GameIdentity } from './session-token-file.js';

export function createGrantedGameIdentityReader(deps: {
  readonly readConsent: () => ConsentRecord;
  readonly readIdentity: (consent: GrantedConsent) => GameIdentity | null;
}): () => GameIdentity | null {
  return () => {
    const consent = deps.readConsent();
    return isGranted(consent) ? deps.readIdentity(consent) : null;
  };
}
