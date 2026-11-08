/**
 * The scrub traversal every live-source artifact shares. One list of personal fields and one
 * traversal, rather than a copy per writer: a second copy is how a key list drifts, and the
 * sensitive-key half is already borrowed from the boundary log for the same reason.
 */

import { isPlainObject } from '@bombfarm/game-api';
import { isSensitiveKey, SENSITIVE_KEY_NAMES } from '../boundary-log/redaction.js';

export const PERSONAL_FIELDS = ['account_id', 'player_name'] as const;

export const REDACTION_PLACEHOLDER = '[redacted]';

export type CredentialRedactor = (text: string) => string;

export function redactText(
  text: string,
  secrets: ReadonlySet<string>,
  credentialRedactor: CredentialRedactor | null,
): string {
  let result = text;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    result = result.split(secret).join(REDACTION_PLACEHOLDER);
  }
  return credentialRedactor ? credentialRedactor(result) : result;
}

/** One traversal applying every scrub rule per node, rather than three passes over the same tree:
 *  a personal field ({@link PERSONAL_FIELDS}) is removed, a sensitive-named key
 *  ({@link isSensitiveKey}, reused from the boundary log rather than a second list) is blanked to
 *  the redacted marker, and any other string is checked for a secret substring. Removal wins when
 *  a key is both a personal field and a sensitive-named key, since the field is dropped before the
 *  sensitive-key check ever runs. */
export function scrubJsonValue(
  value: unknown,
  secrets: ReadonlySet<string>,
  credentialRedactor: CredentialRedactor | null,
): unknown {
  if (Array.isArray(value)) return value.map((item) => scrubJsonValue(item, secrets, credentialRedactor));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if ((PERSONAL_FIELDS as readonly string[]).includes(key)) continue;
      out[key] = isSensitiveKey(key)
        ? redactText(REDACTION_PLACEHOLDER, secrets, credentialRedactor)
        : scrubJsonValue(v, secrets, credentialRedactor);
    }
    return out;
  }
  if (typeof value === 'string') return redactText(value, secrets, credentialRedactor);
  return value;
}

/** Sensitive-named keys that are not credentials: the game account fields pass through the raw
 *  tap by ruling, and the Steam id is not a credential either. */
const NON_CREDENTIAL_SENSITIVE_KEYS = ['accountId', 'playerName', 'steamId64'];

/** Key names removed outright from a raw tap payload: the boundary log's sensitive names minus the
 *  pass-through fields, plus the cookie- and auth-shaped names a game or HTTP payload can carry. */
export const CREDENTIAL_KEY_NAMES: readonly string[] = [
  ...SENSITIVE_KEY_NAMES.filter((name) => !NON_CREDENTIAL_SENSITIVE_KEYS.includes(name)),
  'setCookie',
  'accessToken',
  'refreshToken',
  'idToken',
  'authToken',
  'signInToken',
  'deviceKey',
  'apiKey',
  'bearer',
  'jwt',
  'proxyAuthorization',
  'sessionId',
];

function normalizeCredentialKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

const NORMALIZED_CREDENTIAL_KEYS = new Set(CREDENTIAL_KEY_NAMES.map(normalizeCredentialKey));

function containsSecret(text: string, secrets: ReadonlySet<string>): boolean {
  for (const secret of secrets) {
    if (secret.length > 0 && text.includes(secret)) return true;
  }
  return false;
}

/** Removes credentials from a parsed JSON value. Unlike {@link scrubJsonValue} nothing is masked:
 *  a credential-named key, a key whose string value contains a registered secret, and an array
 *  element that is such a string are all dropped, so no placeholder marks where one was. The
 *  personal fields ({@link PERSONAL_FIELDS}) are kept. Pure; returns a new tree. */
export function scrubCredentials(value: unknown, secrets: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(typeof item === 'string' && containsSecret(item, secrets)))
      .map((item) => scrubCredentials(item, secrets));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (NORMALIZED_CREDENTIAL_KEYS.has(normalizeCredentialKey(key))) continue;
      if (typeof v === 'string' && containsSecret(v, secrets)) continue;
      out[key] = scrubCredentials(v, secrets);
    }
    return out;
  }
  return value;
}
