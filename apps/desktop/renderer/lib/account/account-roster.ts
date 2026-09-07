/**
 * `AccountView` → the roster of {@link HeroRecord}s the account was read holding, plus the
 * account-wide block the same parse produced. Pure, no React import. `parseAccountPayload` is
 * called from the RENDERER on purpose: main detects that the account changed, the renderer is what
 * recomputes from it, and a structural guard fails the build if that identifier ever appears under
 * `apps/desktop/src/main`.
 *
 * Every screen drawing heroes goes through here, so there is one parse of the payload per read and
 * one answer to what the roster is. Nothing farm-shaped may reach this module: a screen that only
 * lists heroes must not have to invent a pool override or a return-bonus mode to see them.
 */
import { parseAccountPayload, type AccountImportData } from '@bombfarm/domain/import-save';
import type { AccountView } from '@bombfarm/contracts';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { capturedAtOf } from './account-facts';

/** One parse of one account read: its completed roster, and the account-wide values beside it. */
export type AccountRoster = {
  readonly heroes: HeroRecord[];
  readonly account: AccountImportData;
};

/** `null` when the payload did not parse at all — never a partial roster over the heroes that did. */
export function buildAccountRoster(view: AccountView): AccountRoster | null {
  const payload = view.payload;

  // `existing` is `[]`: the desktop keeps no local roster, so `matchedExistingId` is always
  // `null` and `isGearRefresh` always `false`.
  const parsed = parseAccountPayload(payload, []);
  if (parsed.rejected !== null) return null;

  const heroesCapturedAt = capturedAtOf(payload, 'heroes');
  const updatedAt = heroesCapturedAt === null ? Date.now() : Date.parse(heroesCapturedAt);

  // Candidate completion is the only synthesis performed. `parseAccountPayload` returns records
  // missing exactly two fields: `id` is the game's own stable hero id, and `updatedAt` is the
  // heroes section's own capture time. No stat is ever synthesised.
  const heroes: HeroRecord[] = parsed.candidates.map((candidate) => ({
    ...candidate.record,
    id: candidate.sourceId,
    updatedAt,
  }));

  return { heroes, account: parsed.account };
}
