/**
 * The copy seam. One module per language, reached through two hooks (`useCopy()`,
 * `useLocale()`), keyed by an exhaustive type. Components read `const t = useCopy()` and use
 * `t.someKey` — never a literal, never a raw import of `en`/`ptBR`.
 *
 * `mp3-i18n` is the swap this seam was reserved for: `Copy` widens from
 * `typeof en`'s string-literal values to plain `string` (one line, below) so a second language can
 * satisfy it; `STRINGS` maps `AppLocale -> Copy`; `CopyProvider` takes a required `locale` prop.
 * `useCopy()`'s signature and return type are UNCHANGED — that is the whole reason a hook was
 * used — so no component call site changes.
 */
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import type {
  AccountSection,
  AccountStoreReason,
  AppLocale,
  DomainLang,
  LiveDiagnosticsDumpReason,
  LiveGapReason,
  SectionStatus,
  SettingsWriteReason,
  UpdateErrorReason,
} from '@bombfarm/contracts';
import { BCP47_BY_LOCALE, DEFAULT_SETTINGS, toDomainLang } from '@bombfarm/contracts';
import type { StatKey } from '@bombfarm/domain/model';
import { en } from './en';
import { ptBR } from './pt-BR';

/**
 * A value-widening mapped type, one line. `en.ts` keeps its `as const` (so its own
 * values stay `readonly` string *literals* for every other purpose); `Copy`'s own values widen to
 * plain `string` so `pt-BR.ts`'s `const ptBR: Copy = { … }` annotation can be satisfied by
 * different (Portuguese) string values while still requiring the exact same key set — a missing
 * key is `TS2741`, an extra/typo'd key is `TS2353`, both naming the key.
 *
 * Rejected, and why: `as Copy` on `ptBR` would suppress both errors — a typo'd key
 * would leave the real key silently missing. `satisfies Copy` checks assignability but keeps the
 * literal type and, critically, gives a weaker (sometimes absent) message on an *extra* key. An
 * index signature (`[key: string]: string`) makes every key optional-by-construction, destroying
 * the fail-the-build-on-a-missing-key guarantee outright — any of the three is forbidden by name in tasks.md.
 */
export type Copy = { readonly [K in keyof typeof en]: string };
export type CopyKey = keyof Copy;

export const STRINGS: Record<AppLocale, Copy> = { en, 'pt-BR': ptBR };

/**
 * The exhaustive-copy-key scope rule: a new `AccountSection` added to the contract without a
 * matching entry here is a compile error, not a nameless chip in the fidelity notice. `CopyKey`
 * values are a subtype of `string`, so this also satisfies `Record<AccountSection, string>`.
 */
export const ACCOUNT_SECTION_COPY_KEY = {
  account: 'sectionNameAccount',
  heroes: 'sectionNameHeroes',
  skills: 'sectionNameSkills',
  casa: 'sectionNameCasa',
  items: 'sectionNameItems',
} as const satisfies Record<AccountSection, CopyKey>;

/** Every `SectionStatus` (`missing` included), mapped exhaustively — a new status is a compile error. */
export const SECTION_STATUS_COPY_KEY = {
  resolved: 'fidelityStatusResolved',
  stale: 'fidelityStatusStale',
  missing: 'fidelityStatusMissing',
  degraded: 'fidelityStatusDegraded',
} as const satisfies Record<SectionStatus, CopyKey>;

/** Every `AccountStoreReason`, mapped exhaustively, in player language. */
export const STORE_REASON_COPY_KEY = {
  empty: 'storeReasonEmpty',
  schema_too_new: 'storeReasonSchemaTooNew',
  corrupt_rebuilt: 'storeReasonCorruptRebuilt',
  not_writable: 'storeReasonNotWritable',
  no_sqlite_binding: 'storeReasonNoSqliteBinding',
  account_mismatch: 'storeReasonAccountMismatch',
} as const satisfies Record<AccountStoreReason, CopyKey>;

/**
 * Every `SettingsWriteReason` (`@bombfarm/contracts`), mapped exhaustively — a new reason
 * is a compile error, matching the four other exhaustive maps in this file. Read by
 * `app/settings/language-section.tsx`'s not-persisted `Banner`.
 */
export const SETTINGS_WRITE_REASON_COPY_KEY = {
  no_store: 'settingsLanguageReasonNoStore',
  not_writable: 'settingsLanguageReasonNotWritable',
  unknown: 'settingsLanguageReasonUnknown',
} as const satisfies Record<SettingsWriteReason, CopyKey>;

/** Every `LiveDiagnosticsDumpReason` (`@bombfarm/contracts`), mapped exhaustively — a new reason
 *  is a compile error, matching this file's other exhaustive maps. Read by
 *  `app/settings/diagnostics-section.tsx`'s not-written `Banner`. */
export const DIAGNOSTICS_DUMP_REASON_COPY_KEY = {
  'rate-limited': 'settingsDiagnosticsReasonRateLimited',
  'write-failed': 'settingsDiagnosticsReasonWriteFailed',
  'no-source': 'settingsDiagnosticsReasonNoSource',
} as const satisfies Record<LiveDiagnosticsDumpReason, CopyKey>;

/** Every `UpdateErrorReason` (`@bombfarm/contracts`), mapped exhaustively — a new reason is a
 *  compile error, matching this file's other exhaustive maps. Read by
 *  `app/settings/updates-section.tsx`'s error `Banner`. */
export const UPDATE_ERROR_REASON_COPY_KEY = {
  offline: 'settingsUpdatesReasonOffline',
  'rate-limited': 'settingsUpdatesReasonRateLimited',
  'no-release': 'settingsUpdatesReasonNoRelease',
  unknown: 'settingsUpdatesReasonUnknown',
} as const satisfies Record<UpdateErrorReason, CopyKey>;

/**
 * Every `LiveGapReason` (`@bombfarm/contracts`), mapped exhaustively — a new reason is a compile
 * error, matching this file's other exhaustive maps. `runtimeUnavailable`'s quarantine-likely
 * variant is not part of this map: it is a separate copy key
 * (`liveGapReasonRuntimeUnavailableQuarantine`) the Live screen chooses at render time from
 * `LiveCurrency.likelyQuarantine`, since that is a boolean orthogonal to the reason itself.
 */
export const LIVE_GAP_REASON_COPY_KEY = {
  clientNotStreaming: 'liveGapReasonClientNotStreaming',
  neverAttached: 'liveGapReasonNeverAttached',
  consentMissing: 'liveGapReasonConsentMissing',
  runtimeUnavailable: 'liveGapReasonRuntimeUnavailable',
  attachFailed: 'liveGapReasonAttachFailed',
  detached: 'liveGapReasonDetached',
  hookSilent: 'liveGapReasonHookSilent',
} as const satisfies Record<LiveGapReason, CopyKey>;

/**
 * Every `StatKey`, mapped exhaustively. `pipelineForHero`'s own `PointValue.label` is
 * Portuguese-only (a pre-i18n artifact of `@bombfarm/domain/model`'s `STAT_LABELS`), so the
 * renderer names each stat itself from `PointValue.stat` rather than rendering `.label`.
 */
export const STAT_NAME_COPY_KEY = {
  energy: 'statNameEnergy',
  attack: 'statNameAttack',
  critDmg: 'statNameCritDmg',
  speed: 'statNameSpeed',
  critChance: 'statNameCritChance',
  penetration: 'statNamePenetration',
  cdr: 'statNameCdr',
} as const satisfies Record<StatKey, CopyKey>;

/**
 * Interpolation in the web's own `{count}`-placeholder shape (`apps/web/src/shared/i18n`), so
 * F4 re-templates nothing.
 */
export function sub(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

interface CopyContextValue {
  readonly copy: Copy;
  readonly locale: AppLocale;
}

const DEFAULT_CONTEXT_VALUE: CopyContextValue = { copy: en, locale: DEFAULT_SETTINGS.locale };

const CopyContext = createContext<CopyContextValue>(DEFAULT_CONTEXT_VALUE);

/**
 * F2 mounted exactly one locale unconditionally; F4 makes `locale` a required prop and provides
 * `STRINGS[locale]` — the only change at the one call site (`page.tsx`, wired in `T4`). `useMemo`
 * keyed on `locale` so switching languages produces one new context value, not a new object on
 * every render.
 *
 * `locale` was briefly defaulted in T2's own commit (`tasks.md`'s named escape hatch: "add a
 * defaulted prop only if the typecheck cannot otherwise pass at the commit boundary"), because
 * `page.tsx` did not pass it until this task. T4 removes that default, per the note it left here.
 */
export function CopyProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const value = useMemo<CopyContextValue>(() => ({ copy: STRINGS[locale], locale }), [locale]);
  return createElement(CopyContext.Provider, { value }, children);
}

export function useCopy(): Copy {
  return useContext(CopyContext).copy;
}

/**
 * Every locale's value for one key, for a control that must reserve layout width against every
 * language at once rather than only the active one (docs/content-fit-ui.md rule 1) — a fixed-width
 * box sized from only the current locale's string would resize itself the moment the language
 * toggles. Consumers stay off the "never a raw import of `en`/`ptBR`" convention this module's own
 * header states, since `STRINGS` (built from both, right here) is the thing they read instead.
 */
export function copyVariants(key: CopyKey): readonly string[] {
  return Object.values(STRINGS).map((copy) => copy[key]);
}

/**
 * The values here are already mapped through `toDomainLang`/`BCP47_BY_LOCALE`, so no
 * component ever performs the `'pt-BR' -> 'pt'` (or the BCP-47) mapping itself.
 */
export function useLocale(): { locale: AppLocale; lang: DomainLang; bcp47: string } {
  const { locale } = useContext(CopyContext);
  return { locale, lang: toDomainLang(locale), bcp47: BCP47_BY_LOCALE[locale] };
}
