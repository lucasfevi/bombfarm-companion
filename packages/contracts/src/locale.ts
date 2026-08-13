/**
 * The desktop's locale token, its one mapping to `@bombfarm/domain`'s (and `apps/web`'s) `Lang`,
 * its Intl/BCP-47 mapping, and the pure startup resolution both processes call (`AD-049`,
 * `AD-053`). Imports only `AppSettings`/`DEFAULT_SETTINGS` from this package's own `index.js` —
 * no Electron module, so `resolveStartupLocale` is unit-testable as a plain table with no running
 * app (`app.getLocale()` is the *caller's* problem, not this file's).
 *
 * `AD-049`: the copy strings stay desktop-local (`apps/desktop/renderer/lib/copy/`); this module
 * is only the token, the mapping, and the resolution — the one thing both processes must agree on.
 */
import type { AppSettings } from './index.js';
import { DEFAULT_SETTINGS } from './index.js';

/**
 * The desktop's own locale union — `apps/web`'s `Lang = 'pt' | 'en'` is untouched (spec Out of
 * Scope). Derived from `AppSettings['locale']`, never re-typed as `'en' | 'pt-BR'` directly, so a
 * future change to that union moves this file with it, or fails loudly, instead of silently
 * diverging.
 */
export type AppLocale = AppSettings['locale'];

/** `@bombfarm/domain`'s `Lang` (`src/shims/i18n.ts`) — the same union `apps/web` uses, which is
 *  why one mapping below serves both. */
export type DomainLang = 'en' | 'pt';

export const APP_LOCALES = ['en', 'pt-BR'] as const satisfies readonly AppLocale[];

/**
 * The **one** place `'pt-BR' -> 'pt'` (and `'en' -> 'en'`) is written (`AD-056`, the success
 * criterion). Every `game-labels.ts` call site threads its language through `toDomainLang`; no
 * call site under `apps/desktop` may write the mapping itself — `i18n-guards.test.ts` asserts it.
 * `as const satisfies Record<AppLocale, DomainLang>` makes a third locale a compile error here.
 */
export const DOMAIN_LANG_BY_LOCALE = {
  en: 'en',
  'pt-BR': 'pt',
} as const satisfies Record<AppLocale, DomainLang>;

/** `Intl`/`toLocaleString` BCP-47 tag per locale (`AD-054`) — the four shipped formatters'
 *  only source of locale-aware grouping/decimal behaviour. */
export const BCP47_BY_LOCALE = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
} as const satisfies Record<AppLocale, string>;

/** The validator a malformed persisted `settings_v1` row meets (`settings-store.ts`, T3). */
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

export function toDomainLang(locale: AppLocale): DomainLang {
  return DOMAIN_LANG_BY_LOCALE[locale];
}

/** The reason a settings write did not persist — `'unknown'` exists for exhaustiveness at the
 *  copy-mapping site (`SETTINGS_WRITE_REASON_COPY_KEY`) even though `settings-store.ts` only ever
 *  produces the other two. */
export type SettingsWriteReason = 'no_store' | 'not_writable' | 'unknown';

export interface SettingsWriteResult {
  /** Always the APPLIED settings, on every branch (MIN-11 — "the language still applies for the
   *  session" is then structural, not a branch someone has to remember to write). */
  readonly settings: AppSettings;
  readonly persisted: boolean;
  /** `null` iff `persisted`. */
  readonly reason: SettingsWriteReason | null;
}

/**
 * Boot-time language resolution (`AD-053`). Pure — imports no Electron module, so the caller
 * (`apps/desktop/src/main/index.ts`, inside `whenReady()`, where `app.getLocale()` is documented
 * to be valid) supplies the OS locale string. Rules, in order:
 *
 * 1. A valid stored override always wins — the OS is not even consulted (MIN-09).
 * 2. Otherwise, the system locale's primary subtag decides: every Portuguese variant (not only
 *    exact `pt-BR`) resolves to `'pt-BR'` — see the `pt-PT` note below — and every English variant
 *    resolves to `'en'` (MIN-06).
 * 3. Otherwise, `DEFAULT_SETTINGS.locale` (MIN-07) — never a throw; this function does string work
 *    on a `string | undefined` and has no other input that could fail.
 *
 * `source` is not decoration: `{ locale: 'en', source: 'system' }` and `{ locale: 'en', source:
 * 'default' }` produce identical `locale` output but mean different things, and both the boot log
 * line and the unit table assert on `source` so the two branches can never be silently merged.
 */
export function resolveStartupLocale(input: {
  readonly stored: AppLocale | null;
  readonly systemLocale: string | undefined;
}): { readonly locale: AppLocale; readonly source: 'stored' | 'system' | 'default' } {
  const { stored, systemLocale } = input;

  if (stored !== null && isAppLocale(stored)) {
    return { locale: stored, source: 'stored' };
  }

  const primary = (systemLocale ?? '').split(/[-_]/)[0]?.toLowerCase() ?? '';

  // pt-PT, pt-AO, bare 'pt', and every other Portuguese variant all resolve to 'pt-BR' — the
  // token names the ONE translation that exists, not a claim about the player's region. A pt-PT
  // player reads PT-BR far more comfortably than English, and this is a fully overridable default
  // (MIN-08), so this is the one place in the resolution where a judgement call exists — stated
  // here, once, and asserted by name in locale.test.ts, rather than left as an unwritten
  // `startsWith` nobody wrote down (spec.md edge case).
  if (primary === 'pt') {
    return { locale: 'pt-BR', source: 'system' };
  }
  if (primary === 'en') {
    return { locale: 'en', source: 'system' };
  }

  return { locale: DEFAULT_SETTINGS.locale, source: 'default' };
}
