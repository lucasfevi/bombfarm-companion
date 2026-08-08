# Explain-tab math sync

**Status:** hard truth  
**Sources:** advice-column IA wave copy drift (2026-07-23); player-facing `explainSections` in `src/shared/i18n`

The collapsible **How the math works** / **Como calculamos tudo** block (`ExplainSection` in `explain-section.tsx`, `src/features/planner/components/`) is the player-facing description of planner math. It must stay aligned with code and with the panels those formulas appear in.

## Rules

1. **WHEN** changing DPS / sheet / combat math in `@bombfarm/domain` (`packages/domain/src` — `model`, `gear`, `derive`, `advisor-pipeline`, `phases`, combat mults, point gains, fuse/walk/cycle, mitigation, HTK, ranking, …) **THEN** update **both** `STRINGS.en.explainSections` and `STRINGS.pt.explainSections` in the same change (or an immediately following commit in the same PR) so prose + `code` blocks match current truth.
2. **WHEN** renaming, moving, adding, or removing a panel or control that the explain text names (Account, House, Skill Tree, Team buffs, Points, Effective stats, Phases / farm phase, cycle/walk/mit/prop, …) **THEN** rewrite the explain (and guide steps that mirror it) to use the **current UI names** — do not leave retired panel names (e.g. Context, Gates, Math check) or removed columns (e.g. Need%).
3. **WHEN** a formula constant or pipeline step changes (point gains, fuse floor, IA efficiency, level power, forge, stamina, …) **THEN** update the matching explain `code` line and the surrounding sentence; do not leave a simplified wrong constant.
4. Prefer **current product vocabulary** over internal type names (`HeroContext`, `gateRows`, …) unless the UI still exposes that term.
5. Keep EN and PT **concept-aligned** (same section order and claims); follow [`i18n.md`](../../../docs/i18n.md) for PT chrome quality.
6. Add or extend a Vitest contract in `src/tests/storage-i18n.test.ts` (or a focused neighbor) when the change would otherwise regress explain wording that already bit us (retired panels, wrong share model, placeholder guide copy).

## Roster gear plan (`@bombfarm/domain/gear-plan` + Gear plan page)

WHEN the roster gear-plan objective, duty weighting (`drainMult`), min-forge normalization (`effectiveUpgrade` / account `forgeFloor`), saturated vs under-saturated regime, final points-pass acceptance, or related UI copy changes, THEN update this doc and **both** `explainSections` entries **9 · Roster gear plan** / **9 · Plano de itens do roster** in `src/shared/i18n/namespaces/advice.ts`, and keep `explain-math-gear-plan.test.ts` asserting EN + PT mention duty weighting and minimum forge / forja mínima in that section.

Player-facing prose in that section must stay plain language ([`i18n.md`](../../../docs/i18n.md)): put `effectiveUpgrade = max(…)` (and similar) only in the section `code` block, never inline in the paragraph. The Min forge (+) chrome tip follows the same rule.

**Solver / waterfall product rules (current truth):**

- Waterfall steps are `today → gear → respec`. The **Today** cell is the baseline — UI omits a `+0` delta (and any other step whose delta is exactly `0`). The `gear` step folds forging and gear moves into one joint decision (`chooseGearCandidate`, `waterfall-guards.ts`): forging is never rejected on its own isolated delta, because it can be net-negative alone yet unlock a move that is net-positive on top of it — the two are decided together, comparing whole end states.
- Two invariants hold **unconditionally, at the roster level**: the final (`respec`) objective is never below today, and the `respec` step's own delta is never negative — `acceptPointResets` only accepts a hero's reset when it raises the roster objective. The `gear` step is the one exception (**option B**): it MAY sit below today, because it is transient — the player climbs back out once the accompanying point resets land. When that happens the plan sets `requiresFullPlan: true` and `gearDipDps` (the positive size of the dip) instead of hiding it or discarding the plan; the gear-plan page must show that dip as a disclosed, temporary state, not a silent loss. Per-hero deltas may still be negative — one hero losing DPS while another (or the roster's duty-weighted saturated objective) gains more is a valid, deliberately allowed plan. Point-reset chore rows are accepted greedily against the ROSTER objective (`acceptPointResets`), not each hero's own `sustained`, so a listed reset row can show a negative per-hero `gainPct` even though the roster step it belongs to never dips.
- Point-reset rows also carry `resetCostGold` (`heroLevel × 1000`, the real in-game price) and `rosterGainDps` (the marginal roster gain at the moment that reset was accepted). Both are **display-only**: they are never part of the objective, never filter or gate a recommendation, and forge/upgrade gold cost is not modelled at all (untraced). Rows are listed in acceptance order (best marginal value first), not alphabetically by hero.
- Per-hero **Proposed items** lists every piece that ends on that hero: moves, forge chores, and equipped pieces the plan leaves untouched. Unchanged keepers stay visible with explicit “existing / no change” copy so an empty card grid only means the hero has no ending gear — never “hidden keepers.”

## Out of scope

- Deep dumps of every derive branch — explain stays a readable summary, not a second `model.ts`.
- Changing math “only in the explain tab” without code — explain follows code, never the reverse.
