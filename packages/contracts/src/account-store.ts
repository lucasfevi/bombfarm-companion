import type { AccountPayload, AccountSection } from './account-payload.js';

/** What the store may say about a section. `resolved` is deliberately not a member. */
export type StoredSectionFidelity =
  | { readonly status: 'stale'; readonly capturedAt: string }
  | { readonly status: 'missing' };

export type StoredAccountFidelity = { readonly [S in AccountSection]: StoredSectionFidelity };

/** Availability of the *store*, distinct from the account's own fidelity grade. */
export type AccountStoreStatus = 'ok' | 'degraded' | 'unavailable';

export type AccountStoreReason =
  | 'empty' // nothing persisted yet
  | 'schema_too_new'
  | 'corrupt_rebuilt'
  | 'not_writable'
  | 'no_sqlite_binding'
  | 'account_mismatch'; // a different account is running

export interface RestoredAccount {
  readonly status: AccountStoreStatus;
  readonly reason: AccountStoreReason | null;
  /** Literal `false`: a restore is never live. The type cannot claim otherwise. */
  readonly gameRunning: false;
  readonly payload: AccountPayload & { readonly fidelity: StoredAccountFidelity };
}

/** What `account:get` serves: live sections where they resolved, stored ones where they did not. */
export interface AccountView {
  readonly payload: AccountPayload;
  readonly gameRunning: boolean;
  readonly store: {
    readonly status: AccountStoreStatus;
    readonly reason: AccountStoreReason | null;
    readonly binding: string | null;
  };
}
