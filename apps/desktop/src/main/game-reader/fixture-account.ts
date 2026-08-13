import { readFileSync } from 'node:fs';
import type { AccountFidelity, AccountPayload, SectionFidelity } from '@bombfarm/contracts';
import { loadFixtureBundle } from './fixture-data.js';

/**
 * `AD-039` (MP3 F2, design.md §3) — a test-only fixture-source override. Honoured **only** when
 * `BFC_GAME_READER === 'fixture'` (already a test-only mode); reads an `AccountPayload`-shaped
 * JSON file from `BFC_FIXTURE_ACCOUNT_FILE` verbatim, in place of the committed
 * `hero-record.json` fixture bundle. Not new ingest — no route, no anchor, no reader, no cadence
 * added; a fixture-source override on the fixture reader only.
 * `fixture-account.test.ts` asserts this is ignored in every other `BFC_GAME_READER` mode, so it
 * can never leak a synthetic account to a real player.
 */
function loadOverridePayload(): AccountPayload | null {
  if (process.env.BFC_GAME_READER !== 'fixture') return null;
  const overridePath = process.env.BFC_FIXTURE_ACCOUNT_FILE;
  if (!overridePath) return null;
  const raw = readFileSync(overridePath, 'utf8');
  return JSON.parse(raw) as AccountPayload;
}

/**
 * The F2 seam (design.md §8): gives the account store a writer before F2's live memory
 * reader exists, so the restart round-trip can be demonstrated end to end. Deliberately
 * partial — `skills`/`casa` have no fixture and stay `missing`, so the smoke exercises the
 * partial-poll rules (APS-05/06/07), not only the happy path.
 */
export function buildFixtureAccountPayload(now: string): AccountPayload {
  const override = loadOverridePayload();
  if (override) return override;

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
