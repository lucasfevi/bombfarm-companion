// Pure grade derivation over an account's per-section provenance (ACS-05). No I/O, no
// payload access — F3/F4 (and MP3) import this without dragging in the 1 MB catalog that
// import-save.ts pulls in.

import type { AccountFidelity, AccountFidelityReport, AccountPayload, AccountSection } from '@bombfarm/contracts';

/** The five account sections, in canonical order (ACS-04 runtime half). */
export const ACCOUNT_SECTIONS = [
  'account',
  'heroes',
  'skills',
  'casa',
  'items',
] as const satisfies readonly AccountSection[];

/**
 * Derives one overall grade plus the names of every non-`resolved` section, from an
 * optional per-section fidelity block. Absent `fidelity` (the file adapter's case, ACS-05.5)
 * grades `full` with an empty list — same rule as an all-`resolved` block. A fidelity block
 * missing a section key at runtime (an untyped producer) is treated as non-`resolved`, never
 * thrown on.
 */
export function deriveAccountFidelity(fidelity?: AccountFidelity): AccountFidelityReport {
  if (!fidelity) {
    return { grade: 'full', degradedSections: [] };
  }

  const degradedSections: AccountSection[] = [];
  let resolvedCount = 0;
  for (const section of ACCOUNT_SECTIONS) {
    if (fidelity[section]?.status === 'resolved') {
      resolvedCount++;
    } else {
      degradedSections.push(section);
    }
  }

  if (degradedSections.length === 0) {
    return { grade: 'full', degradedSections: [] };
  }
  if (resolvedCount === 0) {
    return { grade: 'unavailable', degradedSections };
  }
  return { grade: 'degraded', degradedSections };
}

/** Whether `payload` carries any data at all for `section` (used by the entry point's warning). */
export function sectionHasData(payload: AccountPayload, section: AccountSection): boolean {
  switch (section) {
    case 'account':
      return payload.account !== undefined;
    case 'heroes':
      return payload.heroes !== undefined;
    case 'skills':
      return payload.skills !== undefined;
    case 'casa':
      return payload.casa !== undefined;
    case 'items':
      return payload.items !== undefined;
  }
}
