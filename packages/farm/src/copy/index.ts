/** `@bombfarm/farm/copy` — user-facing strings for the farm screen. */
import { farmEn } from './en';
import { farmPtBR } from './pt-BR';
import type { FarmRosterCopy } from './roster-copy';

export { farmEn } from './en';
export { farmPtBR } from './pt-BR';
export { sub } from './format';
export type { FarmRosterCopy } from './roster-copy';

/** The two languages the farm screen ships in. Spelled as the literal union `@bombfarm/domain`'s
 *  own formatters declare, so the two stay structurally identical. */
export type Lang = 'en' | 'pt';

/**
 * A value-widening mapped type, one line. `en.ts` keeps its `as const` (so its own values stay
 * string *literals* for every other purpose); `FarmCopy`'s own values widen to plain `string` so
 * `pt-BR.ts`'s `const farmPtBR: FarmCopy = { … }` annotation can be satisfied by different
 * (Portuguese) string values while still requiring the exact same key set — a missing key is
 * `TS2741`, an extra/typo'd key is `TS2353`, both naming the key.
 *
 * Rejected, and why: `as FarmCopy` on `farmPtBR` would suppress both errors — a typo'd key would
 * leave the real key silently missing. `satisfies FarmCopy` checks assignability but keeps the
 * literal type and, critically, gives a weaker (sometimes absent) message on an *extra* key. An
 * index signature (`[key: string]: string`) makes every key optional-by-construction, destroying
 * the fail-the-build-on-a-missing-key guarantee outright. All three are forbidden here.
 */
export type FarmCopy = { readonly [K in keyof typeof farmEn]: string };
export type FarmCopyKey = keyof FarmCopy;

/**
 * Everything the farm SCREEN prints: its own dictionary plus the host's hero-identity vocabulary
 * (`FarmRosterCopy`, and see that file for why those strings are not in `farmEn`). A host passes one
 * object satisfying both halves, which is what its own flat dictionary already is.
 */
export type FarmScreenCopy = FarmCopy & FarmRosterCopy;

export const FARM_STRINGS: Record<Lang, FarmCopy> = { en: farmEn, pt: farmPtBR };

export function farmCopyFor(lang: Lang): FarmCopy {
  return FARM_STRINGS[lang];
}
