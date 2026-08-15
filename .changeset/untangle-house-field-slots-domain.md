---
"@bombfarm/domain": patch
---

Finishes untangling House recovery slots from field concurrency slots (started in #86) in two more
places that predate that fix:

- The team-plan optimizer's roster objective (`evaluateRoster`, reached via `TeamPlanAccountInput`)
  used `account.slots` (`casa.slots`, House recovery concurrency) as the field-saturation cap. A
  new `TeamPlanAccountInput.fieldSlots` carries the correct FIELD concurrency number instead
  (`account.fieldSlots ?? account.slots`, same fallback convention as `farm-rate.ts`'s
  `SquadFarmFacts`); on an account where the two disagree (486: 3 vs 6), the optimizer was
  saturating and stopping early with half the field empty.
- `rankRosterByDps`'s default squad-size limit (Phases "top squad" panel, roster ranking) now
  prefers `account.fieldSlots` over `account.slots` for the same reason — the squad it ranks is
  who can be on the field at once, not who the House can refill at once.

No change for a save where the two values agree, or for a legacy record with no `fieldSlots` at
all (still falls back to `account.slots`, then `DEFAULT_CASA_SLOTS`).
