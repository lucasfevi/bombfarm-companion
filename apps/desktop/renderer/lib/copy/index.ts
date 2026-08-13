/**
 * The copy seam (`AD-040`). One module (`en.ts`), reached through one hook (`useCopy()`), keyed
 * by an exhaustive type. Components read `const t = useCopy()` and use `t.someKey` — never a
 * literal, never a raw import of `en`.
 *
 * F4 (`mp3-i18n`) is a swap, not a rewrite: it replaces `useCopy`'s body with `STRINGS[lang]`
 * (mirroring `apps/web/src/shared/i18n/strings.ts`'s `export const STRINGS: Record<Lang, Strings>`)
 * and adds `pt-BR.ts` typed `Copy` — no call site changes.
 */
import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { AccountSection, AccountStoreReason, SectionStatus } from '@bombfarm/contracts';
import type { StatKey } from '@bombfarm/domain/model';
import { en } from './en';

export type Copy = typeof en;
export type CopyKey = keyof Copy;

/**
 * `AD-040` scope rule + MPV-07/MPV-17: a new `AccountSection` added to the contract without a
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

const CopyContext = createContext<Copy>(en);

/** F2 mounts exactly one locale. F4 replaces this body with `STRINGS[lang]` — no call site changes. */
export function CopyProvider({ children }: { children: ReactNode }) {
  return createElement(CopyContext.Provider, { value: en }, children);
}

export function useCopy(): Copy {
  return useContext(CopyContext);
}
