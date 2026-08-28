import type { AccountSection } from '@bombfarm/contracts';

/** The current on-disk account schema version. Bump when `INIT_ACCOUNT_SQL` changes shape. */
export const SCHEMA_VERSION = 1;

/**
 * The five account sections, in canonical order. `packages/domain`'s `ACCOUNT_SECTIONS`
 * (`account-fidelity.ts`) is the authoritative copy — this is a deliberate desktop-local
 * duplicate because `apps/desktop` cannot import `@bombfarm/domain`. See `_AccountSectionsExhaustive` below for the guard that keeps the two in sync.
 */
export const ACCOUNT_SECTIONS = [
  'account',
  'heroes',
  'skills',
  'casa',
  'items',
] as const satisfies readonly AccountSection[];

type AssertExhaustive<T extends never> = T;

/**
 * Compile-time-only. If a sixth `AccountSection` is ever added to `@bombfarm/contracts`
 * without updating the tuple above, `Exclude<AccountSection, (typeof ACCOUNT_SECTIONS)[number]>`
 * evaluates to that new literal instead of `never`, and this line fails
 * `pnpm --filter @bombfarm/desktop typecheck` with "does not satisfy the constraint 'never'".
 */
export type AccountSectionsExhaustive = AssertExhaustive<
  Exclude<AccountSection, (typeof ACCOUNT_SECTIONS)[number]>
>;

/**
 * No status column, by design: status is derived from row presence at the read
 * boundary, so a stored section can never round-trip as `resolved`. Composite primary key is
 * the whole of "schema should not forbid multi-account" (spec Out of Scope row 2) — one column,
 * no UI, no migration, no selection logic.
 */
export const INIT_ACCOUNT_SQL = `
CREATE TABLE IF NOT EXISTS account_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_section (
  account_key TEXT NOT NULL DEFAULT '',
  section     TEXT NOT NULL,
  body        TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (account_key, section)
);
`;
