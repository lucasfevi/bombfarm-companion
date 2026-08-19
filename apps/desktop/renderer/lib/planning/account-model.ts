/**
 * `AccountView` → `PlanningModel` (design.md §4, §8). Pure, no React import — the one place
 * `parseAccountPayload` and `deriveAccountFidelity` are called on the desktop.
 */
import { ACCOUNT_SECTIONS, deriveAccountFidelity, sectionHasData } from '@bombfarm/domain/account-fidelity';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { phaseLine } from '@bombfarm/domain/phases';
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import type { AccountPayload, AccountSection, AccountView, SectionStatus } from '@bombfarm/contracts';
import type { AccountShared } from '@bombfarm/domain/shims/storage';
import type { Availability, AdviceQuantity, PlanningModel, RosterEntry, SectionUsability } from './types';

/** `AD-036`: the withhold gate is per-section usability, not `AccountFidelityReport.grade`. */
export function isUsable(status: SectionStatus): boolean {
  return status === 'resolved' || status === 'stale';
}

/**
 * `AD-041` — advice dependencies as data, not `if`s. Derived from `pipelineForHero`'s inputs
 * (design.md §3 `AD-041` table). Every withhold decision is `requires.every(isUsable)`; no call
 * site re-derives this rule.
 */
export const ADVICE_REQUIRES: Record<AdviceQuantity, readonly AccountSection[]> = {
  rosterRow: ['heroes'],
  gearSummary: ['heroes', 'items'],
  dps: ['heroes', 'items', 'skills', 'casa', 'account'],
  nextPointRanking: ['heroes', 'items', 'skills', 'casa', 'account'],
  resetAdvice: ['heroes', 'items', 'skills', 'casa', 'account'],
};

function sectionsFor(sections: readonly SectionUsability[], quantity: AdviceQuantity): SectionUsability[] {
  const required = ADVICE_REQUIRES[quantity];
  return sections.filter((section) => required.includes(section.section));
}

/** Whether every section `quantity` depends on is currently usable (`AD-041`). */
export function isQuantityUsable(sections: readonly SectionUsability[], quantity: AdviceQuantity): boolean {
  return sectionsFor(sections, quantity).every((section) => section.usable);
}

/** The (not-yet-usable-among-them) sections backing a withheld `quantity`, for `Withheld.sections`. */
export function withheldSections(sections: readonly SectionUsability[], quantity: AdviceQuantity): SectionUsability[] {
  return sectionsFor(sections, quantity);
}

function buildSections(payload: AccountPayload): SectionUsability[] {
  const fidelity = payload.fidelity;
  return ACCOUNT_SECTIONS.map((section) => {
    const sectionFidelity = fidelity?.[section];
    // No fidelity block for this section reads as `missing` — the conservative, withhold-safe
    // default (D24). This differs from `deriveAccountFidelity`'s own "absent fidelity ⇒ grade
    // full" rule, which exists for a different origin path (the web's direct-file import, where
    // every section IS present by construction); the desktop's `AccountView` always carries a
    // real fidelity block from game-api/merge-account, so this branch is defensive only.
    const status: SectionStatus = sectionFidelity?.status ?? 'missing';
    const capturedAt = sectionFidelity && sectionFidelity.status !== 'missing' ? sectionFidelity.capturedAt : null;
    const missingKeys =
      sectionFidelity && sectionFidelity.status === 'degraded' ? sectionFidelity.missingKeys : [];
    return { section, status, capturedAt, missingKeys, usable: isUsable(status) };
  });
}

function findSection(sections: readonly SectionUsability[], section: AccountSection): SectionUsability {
  const found = sections.find((entry) => entry.section === section);
  if (!found) throw new Error(`account-model: no SectionUsability entry for "${section}" — ACCOUNT_SECTIONS drift?`);
  return found;
}

/**
 * `AD-036`'s six-row table (design.md §3). Order matters: `nothing-persisted` and `rejected`
 * take priority over `no-roster` (a rejection names its own reason, never a generic empty
 * roster — spec.md edge case, `AD-BSP-05`); `store-unavailable` is checked only once a usable
 * roster exists, because it is an additional notice layered over otherwise-normal rendering
 * (spec.md edge case: "still render live sections if any resolved"), not an exclusive state.
 */
function deriveAvailability(args: {
  payload: AccountPayload;
  store: AccountView['store'];
  sections: readonly SectionUsability[];
  rejected: ReturnType<typeof parseAccountPayload>['rejected'];
  candidateCount: number;
}): Availability {
  const { payload, store, sections, rejected, candidateCount } = args;

  if (store.reason === 'empty' || ACCOUNT_SECTIONS.every((section) => !sectionHasData(payload, section))) {
    return 'nothing-persisted';
  }
  if (rejected !== null) {
    return 'rejected';
  }
  if (!findSection(sections, 'heroes').usable || candidateCount === 0) {
    return 'no-roster';
  }
  if (store.status === 'unavailable') {
    return 'store-unavailable';
  }
  return sections.every((section) => section.usable) ? 'complete' : 'partial';
}

/**
 * The one place `parseAccountPayload` and `deriveAccountFidelity` are called (design §4).
 * No React import — assert it in the test by reading the source.
 */
export function buildPlanningModel(view: AccountView): PlanningModel {
  const payload = view.payload;
  const report = deriveAccountFidelity(payload.fidelity);
  const sections = buildSections(payload);
  const capturedAt = Object.fromEntries(sections.map((s) => [s.section, s.capturedAt])) as PlanningModel['capturedAt'];

  // `existing` is `[]`: the desktop has no local roster store and is read-only under `D24`, so
  // `matchedExistingId` is always `null` and `isGearRefresh` always `false`.
  const parsed = parseAccountPayload(payload, []);

  const heroesSection = findSection(sections, 'heroes');
  const heroesCapturedAt = heroesSection.capturedAt;
  const heroUpdatedAt = heroesCapturedAt ? Date.parse(heroesCapturedAt) : Date.now();

  // Candidate completion is the only synthesis the desktop performs (design §4.2): `id` is the
  // game's own stable hero id, `updatedAt` is the section's own capture time. No stat is
  // synthesised.
  //
  // T4 finding: parsing must still run unconditionally (rejection reasons and warnings are
  // still meaningful when `heroes` is not usable), but the roster this model EXPOSES must not
  // — `rosterRow` requires `[heroes]` (`ADVICE_REQUIRES`), so a `heroes` section that is not
  // usable withholds every row, not just the numbers on it. Trusting `payload.heroes`'s mere
  // presence over the fidelity status it was asserted under is exactly the labelled-wrong-number
  // hazard `D24` exists to forbid — the fidelity status is authoritative, not the raw payload.
  const heroes: RosterEntry[] = heroesSection.usable
    ? parsed.candidates.map((candidate) => ({
        hero: {
          ...candidate.record,
          id: candidate.sourceId,
          updatedAt: heroUpdatedAt,
        },
        blocked: candidate.blocked,
      }))
    : [];

  const accountUsable = findSection(sections, 'account').usable;
  const skillsUsable = findSection(sections, 'skills').usable;
  const casaUsable = findSection(sections, 'casa').usable;

  const phase = accountUsable ? parsed.account.phase : null;
  const line = phase !== null ? phaseLine(phase) : undefined;
  const mitigationPct = line ? line.mitig * 100 : null;

  const tree = parsed.account.tree;
  const houseIdx = parsed.account.houseIdx;
  const houseLevel = parsed.account.houseLevel;

  // The rule (design §4.3): the desktop never fills a `null` with a default. There is no
  // `DEFAULT_TREE()` and no `DEFAULT_CONTEXT()` anywhere in `apps/desktop` — if any of the
  // values below is `null`, or the backing section is not usable, `shared` stays `null` and
  // `pipelineForHero` is never called for any hero (see `hero-advice.ts`).
  //
  // `teamBuffs` is not gated here: it is not one of the five account sections. Issue #132:
  // `zeroTeamBuffs()` used to be a harmless placeholder because `abilityMods` folded a hero's
  // own rank into its own combat mods regardless of any account-wide total; once that folding
  // was removed, a stored zero here meant every hero — including a carrier itself — read zero
  // team-aura benefit, with no UI on the desktop to correct it (no auto-fill button, no manual
  // fields). `computeTeamBuffsFromDeployed` derives the true total from this same `heroes`
  // roster, exactly as the web farm board does. Always derived, never an override: there is no
  // team-buffs UI on the desktop (out of scope for F2), so there is nothing for an override to
  // record.
  const shared: AccountShared | null =
    skillsUsable &&
    casaUsable &&
    accountUsable &&
    tree !== null &&
    houseIdx !== null &&
    houseLevel !== null &&
    phase !== null &&
    mitigationPct !== null
      ? {
          tree: {
            danoTotal: tree.danoTotal,
            critChance: tree.critChance,
            critDmg: tree.critDmg,
            speed: tree.speed,
            energy: tree.energy,
            teamCoinPct: tree.teamCoinPct ?? 0,
            luckFlatPct: tree.luckFlatPct,
          },
          teamBuffs: computeTeamBuffsFromDeployed(heroes.map((entry) => entry.hero)),
          context: {
            houseIdx,
            houseLevel,
            phase,
            mitigationPct,
            rankMode: 'dps',
            targetProp: DEFAULT_TARGET_PROP,
          },
          slots: parsed.account.slots ?? undefined,
          fieldSlots: parsed.account.fieldSlots ?? null,
          houseCycleSecs: parsed.account.houseCycleSecs ?? null,
        }
      : null;

  const availability = deriveAvailability({
    payload,
    store: view.store,
    sections,
    rejected: parsed.rejected,
    candidateCount: parsed.candidates.length,
  });

  return {
    availability,
    report,
    sections,
    store: view.store,
    rejected: parsed.rejected,
    heroes,
    shared,
    phase,
    mitigationPct,
    capturedAt,
  };
}
