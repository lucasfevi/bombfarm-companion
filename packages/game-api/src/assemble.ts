import type { AccountFidelity, AccountPayload, AccountSection, SectionFidelity } from '@bombfarm/contracts';
import type { SectionOutcome } from './routes.js';

/**
 * Assembles one cycle's outcomes into an `AccountPayload` (LAR-07 assembly half, LAR-14, LAR-15,
 * LAR-17, LAR-19 reporting half). Deliberately shorter than the retired memory-era version: there
 * is no carry-over here, no grade, and no history parameter — `assembleAccountPayload.length` is
 * 2, closing `R-1` by signature. F3's `commit()` is the single place last-known-good exists.
 *
 * | Outcome  | Body            | Fidelity                                          |
 * |----------|-----------------|----------------------------------------------------|
 * | `ok`     | present         | `{status:'resolved', capturedAt: now}`             |
 * | `drift`  | **absent**      | `{status:'degraded', capturedAt: now, missingKeys}`|
 * | `failed` | **absent**      | `{status:'missing'}` (no `capturedAt`)             |
 *
 * A `failed` or `drift` outcome for `skills` produces a payload with no `skills` key at all —
 * `'skills' in payload === false`, not `payload.skills === undefined` — which is the specific
 * failure `D24` was written about (LAR-10): the parser must never mistake absence for an empty,
 * zeroed skill tree.
 */
export function assembleAccountPayload(
  outcomes: Readonly<Record<AccountSection, SectionOutcome>>,
  now: string,
): AccountPayload {
  const fidelity: AccountFidelity = {
    account: sectionFidelity(outcomes.account, now),
    heroes: sectionFidelity(outcomes.heroes, now),
    skills: sectionFidelity(outcomes.skills, now),
    casa: sectionFidelity(outcomes.casa, now),
    items: sectionFidelity(outcomes.items, now),
  };

  return {
    ...(outcomes.account.kind === 'ok' ? { account: outcomes.account.body as Record<string, unknown> } : {}),
    ...(outcomes.heroes.kind === 'ok' ? { heroes: outcomes.heroes.body as readonly unknown[] } : {}),
    ...(outcomes.skills.kind === 'ok' ? { skills: outcomes.skills.body as Record<string, unknown> } : {}),
    ...(outcomes.casa.kind === 'ok' ? { casa: outcomes.casa.body as Record<string, unknown> } : {}),
    ...(outcomes.items.kind === 'ok' ? { items: outcomes.items.body as readonly unknown[] } : {}),
    fidelity,
  };
}

function sectionFidelity(outcome: SectionOutcome, now: string): SectionFidelity {
  if (outcome.kind === 'ok') {
    return { status: 'resolved', capturedAt: now };
  }
  if (outcome.kind === 'drift') {
    return { status: 'degraded', capturedAt: now, missingKeys: outcome.missingKeys };
  }
  return { status: 'missing' };
}
