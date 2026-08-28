/**
 * The feature's whole decision surface, typed (design.md §8). All serialisable, none persisted:
 * no IPC contract, no SQLite column, no persisted key is added — `@bombfarm/contracts` is not
 * edited by this feature.
 */
import type { AccountFidelityReport, AccountSection, SectionStatus, AccountView } from '@bombfarm/contracts';
import type { ParseRejection } from '@bombfarm/domain/import-save';
import type { PointValue } from '@bombfarm/domain/model';
import type { ResetAdvice } from '@bombfarm/domain/advisor-tables';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';

export type SectionUsability = {
  readonly section: AccountSection;
  readonly status: SectionStatus;
  readonly capturedAt: string | null;
  readonly missingKeys: readonly string[];
  readonly usable: boolean;
};

/**
 * The rule that advice is gated by per-section usability, not by `AccountFidelityReport.grade`,
 * resolving the tension between rendering the roster from a persisted account and unavailable
 * data rendering no numbers: a computed verdict, distinct from
 * `AccountFidelityReport.grade` (which is `unavailable` after every restart on a healthy store —
 * §2.1 of design.md). See design.md §3 for the condition ↔ render mapping table.
 */
export type Availability =
  | 'nothing-persisted'
  | 'store-unavailable'
  | 'rejected'
  | 'no-roster'
  | 'partial'
  | 'complete';

/** A parsed candidate, completed with `id`/`updatedAt` (the only synthesis the desktop performs — design §4.2). */
export type RosterEntry = {
  readonly hero: HeroRecord;
  /** `ImportCandidate.blocked` — withholds this hero's `dps`/`nextPointRanking`/`resetAdvice` only. */
  readonly blocked: boolean;
};

export type PlanningModel = {
  readonly availability: Availability;
  /** From `@bombfarm/domain`'s `deriveAccountFidelity`, unchanged — the provenance display (full shows no degradation chrome; every degraded section named, in report order). */
  readonly report: AccountFidelityReport;
  /** `ACCOUNT_SECTIONS` order (every degraded section named, in report order). */
  readonly sections: readonly SectionUsability[];
  readonly store: AccountView['store'];
  readonly rejected: ParseRejection | null;
  readonly heroes: readonly RosterEntry[];
  /** `null` ⇒ every quantity gated on `skills`/`casa`/`account` is withheld for every hero. */
  readonly shared: AccountShared | null;
  readonly phase: number | null;
  readonly mitigationPct: number | null;
  readonly capturedAt: { readonly [S in AccountSection]: string | null };
};

/** The five things the pipeline can produce, each gated by its own dependency set — declared as data, not as ifs. */
export type AdviceQuantity = 'rosterRow' | 'gearSummary' | 'dps' | 'nextPointRanking' | 'resetAdvice';

export type Withheld = {
  readonly withheld: true;
  readonly quantity: AdviceQuantity;
  /** The subset of `PlanningModel.sections` this quantity depends on — always the not-yet-usable ones among them. */
  readonly sections: readonly SectionUsability[];
};

export type HeroAdvice = {
  readonly withheld: false;
  readonly dps: number;
  readonly ranking: readonly PointValue[];
  readonly best: PointValue;
  readonly resetAdvice: ResetAdvice;
};
