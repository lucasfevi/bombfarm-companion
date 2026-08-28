import type { AccountSection } from '@bombfarm/contracts';

/**
 * `invalid_json`/`wrong_container` are `decodeStoredSection`'s own two failure modes, unchanged
 * by this feature. `stale_retired_vocabulary` is a THIRD member added alongside them — never
 * produced by `decodeStoredSection` itself, which stays a pure format decoder. `account-store.ts`'s
 * `restore()` uses it to tag its `account.row_dropped` log line with the same "why this section
 * isn't served" vocabulary as `account.row_discarded`, after `judgeStoredSection`
 * (`stale-sections.ts`) rules the successfully-decoded body stale.
 */
export type DecodedSectionReason = 'invalid_json' | 'wrong_container' | 'stale_retired_vocabulary';

export type DecodedSection = { ok: true; body: unknown } | { ok: false; reason: DecodedSectionReason };

const ARRAY_SECTIONS: ReadonlySet<AccountSection> = new Set(['heroes', 'items']);

/**
 * Decodes a stored row's `body` text for `section`. Never throws for any input string.
 * Performs no field-level normalization, defaulting, key-stripping or coercion — an
 * unfamiliar extra key and the original key order both survive untouched (the
 * desktop normalizes nothing; payload-level normalization is F1's `parseAccountPayload`).
 */
export function decodeStoredSection(section: AccountSection, text: string): DecodedSection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  const isArray = Array.isArray(parsed);
  if (ARRAY_SECTIONS.has(section)) {
    return isArray ? { ok: true, body: parsed } : { ok: false, reason: 'wrong_container' };
  }

  const isPlainObject = typeof parsed === 'object' && parsed !== null && !isArray;
  return isPlainObject ? { ok: true, body: parsed } : { ok: false, reason: 'wrong_container' };
}

export interface AccountKeyResolution {
  /** The key reads/writes should use. `''` means "unknown/unbound". */
  key: string;
  /** True iff `incoming` names a different, already-bound account. */
  mismatch: boolean;
  /** True iff this resolution moves the bound key forward (a first bind or a rebind). */
  rebind: boolean;
}

/**
 * The account-scoping rule. `incoming === null` means "no live account id is
 * knowable right now" (cold start) and always defers to whatever is already bound. A bound
 * key of `null` or `''` both mean "unset". A different incoming key is a mismatch: reads
 * under the stale bound key report `missing` for everything, and writes start a new key
 * without touching the old one's rows.
 */
export function resolveAccountKey(bound: string | null, incoming: string | null): AccountKeyResolution {
  if (incoming === null) {
    return { key: bound ?? '', mismatch: false, rebind: false };
  }

  const boundIsUnset = bound === null || bound === '';
  if (boundIsUnset) {
    return { key: incoming, mismatch: false, rebind: true };
  }

  if (bound === incoming) {
    return { key: bound, mismatch: false, rebind: false };
  }

  return { key: incoming, mismatch: true, rebind: true };
}
