import type { AccountFidelity, AccountPayload, SectionFidelity } from '@bombfarm/contracts';
import { loadFixtureBundle } from './fixture-data.js';

/**
 * The F2 seam (design.md §8): gives the account store a writer before F2's live memory
 * reader exists, so the restart round-trip can be demonstrated end to end. Deliberately
 * partial — `skills`/`casa` have no fixture and stay `missing`, so the smoke exercises the
 * partial-poll rules (APS-05/06/07), not only the happy path.
 */
export function buildFixtureAccountPayload(now: string): AccountPayload {
  const fixtures = loadFixtureBundle();

  const resolved: SectionFidelity = { status: 'resolved', capturedAt: now };
  const missing: SectionFidelity = { status: 'missing' };

  const fidelity: AccountFidelity = {
    account: resolved,
    heroes: resolved,
    skills: missing,
    casa: missing,
    items: resolved,
  };

  return {
    account: fixtures.state,
    heroes: fixtures.heroRecords,
    items: fixtures.inventory.items,
    fidelity,
  };
}
