import type { GrantedConsent } from '@bombfarm/game-api';
import type { SessionTokenFileResult } from './game-api/session-token-file.js';

export interface CredentialRedactorSink {
  setCredentialRedactor(redact: ((text: string) => string) | null): void;
}

export interface RedactingTokenReaderDeps {
  readToken: (consent: GrantedConsent) => SessionTokenFileResult;
  logSink: CredentialRedactorSink;
  /** A getter: the live source is built during boot, long after this reader is composed. */
  getLiveSource: () => CredentialRedactorSink | null;
}

/**
 * Both sinks that can write the account token to disk — the boundary log under `%APPDATA%`, which
 * users attach to bug reports, and the live source's frame ring and observation capture — learn to
 * mask it here, on every successful read. A failed read installs on neither: a stale redactor from
 * a previous token would mask the wrong value, and a no-op would mask nothing while looking wired.
 */
export function createRedactingTokenReader(
  deps: RedactingTokenReaderDeps,
): (consent: GrantedConsent) => SessionTokenFileResult {
  return (consent) => {
    const result = deps.readToken(consent);
    if (result.ok) {
      const redact = (text: string): string => result.token.redactFrom(text);
      deps.logSink.setCredentialRedactor(redact);
      deps.getLiveSource()?.setCredentialRedactor(redact);
    }
    return result;
  };
}
