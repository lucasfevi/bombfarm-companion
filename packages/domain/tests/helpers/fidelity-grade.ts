/**
 * MP2 F4 — the degraded-input guard (design §4.2). Decides, before any comparison, whether a
 * live capture is even gradeable. FID-05/06/07.
 */
import type { AccountFidelity, AccountPayload, AccountSection, SectionFidelity } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS, deriveAccountFidelity } from '@bombfarm/domain/account-fidelity';
import { FidelityGateError } from './fidelity-gate-error';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUsableSectionShape(value: unknown): value is SectionFidelity {
  if (!isObject(value)) return false;
  const status = value.status;
  if (typeof status !== 'string' || status.length === 0) return false;
  if (status !== 'missing' && typeof value.capturedAt !== 'string') return false;
  return true;
}

/**
 * The FID-05/06/07 gate, ordered presence-check → shape-check → grade-check.
 *
 * 1. `payload.fidelity` absent ⇒ `unverifiableFidelity` (FID-07). `deriveAccountFidelity` is
 *    deliberately never consulted for this branch — `ACS-05.5` makes it grade an absent block
 *    `full`, which is correct for the file adapter and exactly the default this guard forbids
 *    for a live capture (design TD-3).
 * 2. Any of the five `ACCOUNT_SECTIONS` keys missing from the block, or shaped so that
 *    `status` is not a non-empty string, or `capturedAt` absent on anything but `missing` ⇒
 *    `unverifiableFidelity` naming the offending section.
 * 3. `deriveAccountFidelity(fidelity).grade !== 'full'` ⇒ `notFullFidelity`, message listing
 *    every non-`resolved` section in `ACCOUNT_SECTIONS` order as `` `<section>: <status>` ``,
 *    using the section's *literal* status string — so a future `degraded` status (`AD-023`)
 *    prints correctly with zero edits to this file.
 */
export function assertCaptureFullFidelity(payload: AccountPayload, label: string): void {
  const fidelity = payload.fidelity;
  if (fidelity === undefined) {
    throw new FidelityGateError(
      'unverifiableFidelity',
      `${label} capture carries no fidelity block — a capture that does not state its own fidelity is unverifiable, not "full".`,
      { label },
    );
  }

  const fidelityRecord = fidelity as unknown as Record<AccountSection, unknown>;
  for (const section of ACCOUNT_SECTIONS) {
    const sectionValue = fidelityRecord[section];
    if (sectionValue === undefined) {
      throw new FidelityGateError(
        'unverifiableFidelity',
        `${label} capture's fidelity block is missing the "${section}" section — a capture that does not state every section's fidelity is unverifiable.`,
        { label, section },
      );
    }
    if (!isUsableSectionShape(sectionValue)) {
      throw new FidelityGateError(
        'unverifiableFidelity',
        `${label} capture's fidelity block has an unusable shape for section "${section}" (missing/blank status, or missing capturedAt on a non-missing status).`,
        { label, section, value: sectionValue },
      );
    }
  }

  const report = deriveAccountFidelity(fidelity as AccountFidelity);
  if (report.grade !== 'full') {
    const lines = ACCOUNT_SECTIONS.filter((section) => fidelityRecord[section] !== undefined)
      .filter((section) => (fidelityRecord[section] as SectionFidelity).status !== 'resolved')
      .map((section) => `${section}: ${(fidelityRecord[section] as SectionFidelity).status}`);
    throw new FidelityGateError(
      'notFullFidelity',
      `${label} capture is not full fidelity (grade: ${report.grade}). Degraded sections — ${lines.join(', ')}.`,
      { label, grade: report.grade, degradedSections: report.degradedSections },
    );
  }
}
