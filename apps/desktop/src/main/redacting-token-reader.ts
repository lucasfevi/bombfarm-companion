import { isGranted, type ConsentRecord, type GrantedConsent } from '@bombfarm/game-api';
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

export interface ArmCredentialRedactorDeps {
  readConsent: () => ConsentRecord;
  /** The reader {@link createRedactingTokenReader} returns, so a successful read installs on both sinks. */
  readToken: (consent: GrantedConsent) => SessionTokenFileResult;
}

/**
 * One read for its side effect, before the live source starts. The tap delivers frames as soon as
 * it starts, while the account cycle's first read comes only after boot has awaited the main
 * window — and until a read lands, the frame ring and the developer capture scrub by key name
 * alone, so a token under any other key would reach disk in clear. Without account consent the
 * token file is never read, here or anywhere else.
 */
export function armCredentialRedactor(deps: ArmCredentialRedactorDeps): void {
  const consent = deps.readConsent();
  if (isGranted(consent)) deps.readToken(consent);
}
