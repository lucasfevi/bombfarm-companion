import type { AccountPayload, AccountSection, AccountView, RestoredAccount, SectionFidelity } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS } from './account-schema.js';

export interface MergeOpts {
  gameRunning: boolean;
  /** The SQLite binding the store opened with, surfaced on `AccountView.store` so a consumer
   * can say *why* persistence is degraded. `null` when the store never opened one. */
  binding: string | null;
}

/** The container kind each section's body must have before anything can read it. */
export function isUsableSectionBody(section: AccountSection, body: unknown): boolean {
  if (section === 'heroes' || section === 'items') return Array.isArray(body);
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/** The skill tree feeds every hero sheet, so a live read that lost a total must not replace the
 *  last complete one: the stored tree is served, and the live body is never written over it. */
export function lostRequiredKeys(section: AccountSection, fidelity: SectionFidelity | undefined): readonly string[] {
  return section === 'skills' && fidelity?.status === 'degraded' ? fidelity.missingKeys : [];
}

/**
 * Serves live sections over stored last-known-good, per section, in
 * `ACCOUNT_SECTIONS` order. Pure — no DB, no clock.
 *
 * `resolved` and `degraded` are both "this cycle actually read and parsed something". A
 * `degraded` live section is served, still reported `degraded` with the keys it lost, whenever
 * its body has the container kind the section needs — the readers of each field say for
 * themselves what an absent field means. Old data is the fallback only for a live body that is
 * absent or cannot be read at all, along with `stale`/`missing` and any genuinely unrecognized
 * future status.
 *
 * The one exception is `skills`: a live body missing a required key yields the stored section
 * (`stale`) or, with none stored, `missing`, either way carrying the keys it lost in `lostKeys`.
 */
export function mergeStoredIntoLive(live: AccountPayload, restored: RestoredAccount, opts: MergeOpts): AccountView {
  const liveUntyped = live as unknown as Record<string, unknown>;
  const restoredUntyped = restored.payload as unknown as Record<string, unknown>;

  const merged: Partial<Record<AccountSection, unknown>> = {};
  const fidelity = {} as Record<AccountSection, SectionFidelity>;

  for (const section of ACCOUNT_SECTIONS) {
    const liveFidelity = live.fidelity?.[section];
    const liveBody = liveUntyped[section];
    const storedFidelity = restored.payload.fidelity[section];
    const storedUsable = storedFidelity.status === 'stale';

    if (liveFidelity?.status === 'resolved' && liveBody !== undefined) {
      fidelity[section] = { status: 'resolved', capturedAt: liveFidelity.capturedAt };
      merged[section] = liveBody;
      continue;
    }

    const lostKeys = lostRequiredKeys(section, liveFidelity);
    const carriedLostKeys =
      lostKeys.length > 0
        ? lostKeys
        : liveFidelity?.status === 'stale' || liveFidelity?.status === 'missing'
          ? liveFidelity.lostKeys
          : undefined;

    if (liveFidelity?.status === 'degraded' && lostKeys.length === 0 && isUsableSectionBody(section, liveBody)) {
      fidelity[section] = {
        status: 'degraded',
        capturedAt: liveFidelity.capturedAt,
        missingKeys: liveFidelity.missingKeys,
        addedKeys: liveFidelity.addedKeys,
      };
      merged[section] = liveBody;
      continue;
    }

    if (storedUsable) {
      fidelity[section] = {
        status: 'stale',
        capturedAt: storedFidelity.capturedAt,
        ...(carriedLostKeys === undefined ? {} : { lostKeys: carriedLostKeys }),
      };
      merged[section] = restoredUntyped[section];
      continue;
    }

    fidelity[section] = { status: 'missing', ...(carriedLostKeys === undefined ? {} : { lostKeys: carriedLostKeys }) };
  }

  return {
    payload: { ...merged, fidelity } as AccountPayload,
    gameRunning: opts.gameRunning,
    store: { status: restored.status, reason: restored.reason, binding: opts.binding },
  };
}
