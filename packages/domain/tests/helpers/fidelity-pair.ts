/**
 * MP2 F4 — the deterministic export→live framing helper for the fidelity gate.
 *
 * `frameLiveCapture` / `scrubPersonalFields` are pure, non-throwing transforms used both to
 * build the committed `live-capture.json` and, pre-F2, to prove that file is exactly what the
 * framing function produces from the committed export (design §1.1, `AD-026`). The fail-loud
 * loader (`loadFidelityPair`) is added on top of this in a follow-up task.
 */
import type { AccountFidelity, AccountPayload } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Removes `account.account_id` and `account.player_name` — nothing else. Leaves every other
 * key, including every other `account` field, untouched. Non-destructive: returns a new object,
 * never mutates `o`.
 */
export function scrubPersonalFields(o: Record<string, unknown>): Record<string, unknown> {
  const account = o.account;
  if (!isObject(account)) {
    return { ...o };
  }
  const scrubbedAccount = { ...account };
  delete scrubbedAccount.account_id;
  delete scrubbedAccount.player_name;
  return { ...o, account: scrubbedAccount };
}

/** Stamp applied to every section of the synthesised `fidelity` block. */
export interface FrameStamp {
  readonly capturedAt: string;
}

/**
 * Deterministic export → live framing (design §1.1): lifts the five `AccountPayload` sections
 * out of a scrubbed export object, drops the two file-only keys (`export_version`,
 * `generated_at` — ACS-06), and attaches a five-section `fidelity` block stamped `resolved` at
 * `stamp.capturedAt`. Calling this twice on the same input produces byte-identical output
 * (T1's `Done when` — the regeneration proof for the committed `live-capture.json`).
 */
export function frameLiveCapture(exportObject: Record<string, unknown>, stamp: FrameStamp): AccountPayload {
  const scrubbed = scrubPersonalFields(exportObject);

  const fidelity = ACCOUNT_SECTIONS.reduce<Record<string, { status: 'resolved'; capturedAt: string }>>(
    (acc, section) => {
      acc[section] = { status: 'resolved', capturedAt: stamp.capturedAt };
      return acc;
    },
    {},
  ) as AccountFidelity;

  return {
    account: scrubbed.account as AccountPayload['account'],
    heroes: scrubbed.heroes as AccountPayload['heroes'],
    skills: scrubbed.skills as AccountPayload['skills'],
    casa: scrubbed.casa as AccountPayload['casa'],
    items: scrubbed.items as AccountPayload['items'],
    fidelity,
  };
}
