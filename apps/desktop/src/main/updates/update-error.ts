import type { UpdateErrorReason } from '@bombfarm/contracts';

/**
 * `electron-updater` surfaces every failure as prose assembled from Node error codes and HTTP
 * status text, so the only way to tell "you are offline" from "GitHub is rate-limiting you" is to
 * read that string. These are patterns matched against a third-party library's own English
 * output, never text this app displays — the player-facing half is a `UpdateErrorReason` the
 * renderer translates. Anything unrecognised is `unknown` rather than a guess, and the raw
 * message still reaches the log.
 */
const REASON_PATTERNS: ReadonlyArray<readonly [UpdateErrorReason, RegExp]> = [
  ['offline', /net::|enotfound|econnrefused|econnreset|etimedout|getaddrinfo|offline|network/],
  ['rate-limited', /rate\s*limit|\b429\b|\b403\b/],
  ['no-release', /\b404\b|no\s+published\s+versions|cannot\s+find\s+channel/],
];

export function classifyUpdateError(error: unknown): UpdateErrorReason {
  const lower = updateErrorMessage(error).toLowerCase();
  for (const [reason, pattern] of REASON_PATTERNS) {
    if (pattern.test(lower)) {
      return reason;
    }
  }
  return 'unknown';
}

/**
 * Anything that is not an `Error`, a string, or a primitive becomes the empty string rather than
 * `[object Object]` — an unreadable log line and, worse, a value the patterns above could match
 * on by accident.
 */
export function updateErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error);
  }
  return '';
}
