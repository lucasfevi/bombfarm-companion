import type { AccountFidelity, AccountPayload, AccountSection, SectionFidelity } from '@bombfarm/contracts';
import type { SectionOutcome } from './routes.js';

/**
 * Assembles one cycle's outcomes into an `AccountPayload` (LAR-07 assembly half, LAR-14, LAR-15,
 * LAR-17, LAR-19 reporting half). Deliberately shorter than the retired memory-era version: there
 * is no carry-over here, no grade, and no history parameter — `assembleAccountPayload.length` is
 * 2, closing `R-1` by signature. F3's `commit()` is the single place last-known-good exists.
 *
 * | Outcome  | Body            | Fidelity                                                    |
 * |----------|-----------------|--------------------------------------------------------------|
 * | `ok`     | present         | `{status:'resolved', capturedAt: now}`                       |
 * | `drift`  | present         | `{status:'degraded', capturedAt: now, missingKeys, addedKeys}`|
 * | `failed` | **absent**      | `{status:'missing'}` (no `capturedAt`)                        |
 *
 * A cosmetic added key next to four untouched keys no longer blanks the whole section — only the
 * datum the break actually touches is lost, reported via `missingKeys`/`addedKeys` on `degraded`.
 *
 * The body a `drift` carries passed `route.acceptProjected`, and how much that promises depends on
 * the route: the two collection routes reject a projection that is not the array they exist to
 * carry, so their drift bodies are structurally usable. The three identity-projected routes
 * (`/state`, `/skill/state`, `/rotation`) project the response object itself, which `readSection`
 * has already established is a plain object — so their check cannot fail, and a drift body from
 * one of them may be missing any key below the root. Consumers read those bodies defensively and
 * consult `missingKeys` rather than assuming a key survived.
 *
 * A `failed` outcome for `skills` still produces a payload with no `skills` key at all —
 * `'skills' in payload === false`, not `payload.skills === undefined` — which is the specific
 * failure `D24` was written about (LAR-10): the parser must never mistake absence for an empty,
 * zeroed skill tree. `drift` is deliberately not held to that rule any more — it carries a real,
 * usable body, not a fabricated one.
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

  const hasBody = (outcome: SectionOutcome): outcome is Extract<SectionOutcome, { body: unknown }> =>
    outcome.kind === 'ok' || outcome.kind === 'drift';

  return {
    ...(hasBody(outcomes.account) ? { account: outcomes.account.body as Record<string, unknown> } : {}),
    ...(hasBody(outcomes.heroes) ? { heroes: outcomes.heroes.body as readonly unknown[] } : {}),
    ...(hasBody(outcomes.skills) ? { skills: outcomes.skills.body as Record<string, unknown> } : {}),
    ...(hasBody(outcomes.casa) ? { casa: outcomes.casa.body as Record<string, unknown> } : {}),
    ...(hasBody(outcomes.items) ? { items: outcomes.items.body as readonly unknown[] } : {}),
    fidelity,
  };
}

function sectionFidelity(outcome: SectionOutcome, now: string): SectionFidelity {
  if (outcome.kind === 'ok') {
    return { status: 'resolved', capturedAt: now };
  }
  if (outcome.kind === 'drift') {
    return { status: 'degraded', capturedAt: now, missingKeys: outcome.missingKeys, addedKeys: outcome.addedKeys };
  }
  return { status: 'missing' };
}
