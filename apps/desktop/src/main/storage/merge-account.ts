import type { AccountPayload, AccountSection, AccountView, RestoredAccount, SectionFidelity } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS } from './account-schema.js';

export interface MergeOpts {
  gameRunning: boolean;
  /** The SQLite binding the store opened with, surfaced on `AccountView.store` so a consumer
   * can say *why* persistence is degraded. `null` when the store never opened one. */
  binding: string | null;
}

/**
 * APS-06's teeth: serves live sections over stored last-known-good, per section, in
 * `ACCOUNT_SECTIONS` order. Pure — no DB, no clock. The branch is `!== 'resolved'`, not an
 * enumeration (design TD-9): a live section cast to a future status (e.g. `degraded`,
 * `AD-023`) falls through to the stored value exactly like `stale`/`missing` do, with no
 * edit needed here when that member is added.
 */
export function mergeStoredIntoLive(live: AccountPayload, restored: RestoredAccount, opts: MergeOpts): AccountView {
  const liveUntyped = live as unknown as Record<string, unknown>;
  const restoredUntyped = restored.payload as unknown as Record<string, unknown>;

  const merged: Partial<Record<AccountSection, unknown>> = {};
  const fidelity = {} as Record<AccountSection, SectionFidelity>;

  for (const section of ACCOUNT_SECTIONS) {
    const liveFidelity = live.fidelity?.[section];
    const liveBody = liveUntyped[section];

    if (liveFidelity?.status === 'resolved' && liveBody !== undefined) {
      fidelity[section] = { status: 'resolved', capturedAt: liveFidelity.capturedAt };
      merged[section] = liveBody;
      continue;
    }

    const storedFidelity = restored.payload.fidelity[section];
    if (storedFidelity.status === 'stale') {
      fidelity[section] = { status: 'stale', capturedAt: storedFidelity.capturedAt };
      merged[section] = restoredUntyped[section];
      continue;
    }

    fidelity[section] = { status: 'missing' };
  }

  return {
    payload: { ...merged, fidelity } as AccountPayload,
    gameRunning: opts.gameRunning,
    store: { status: restored.status, reason: restored.reason, binding: opts.binding },
  };
}
