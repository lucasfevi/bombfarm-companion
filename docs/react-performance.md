# React performance

**Status:** hard truth
**Cursor stub:** [`.cursor/rules/react-performance.mdc`](../.cursor/rules/react-performance.mdc)

**React Compiler is ON** (`experimental.reactCompiler: true` in `next.config.ts` on Next 15.5; `babel-plugin-react-compiler`).

Structural splits and the memoized advisor **selector** (not a component-level `useMemo` anymore — see rule 3) stay mandatory. Hand `memo`/`useCallback` at proven boundaries are load-bearing — see rule 6 for the W8 finding that closes this question.

## When adding or updating a feature

1. Colocate new UI state in the leaf/shell that owns it — not the root composer (`src/features/planner/components/hero-planner.tsx`). State enters `shared/stores/` only if a second feature reads/writes it or it is persisted ([`state-management.md`](state-management.md), draft — MOD-13).
2. Ask: will this `setState` dirty roster + gear + advice? If yes, split or colocate.
3. O(n) roster work or 10+ DPS sims → subscribe via `selectAdvisorPipeline` (module-level memoized **selector** in `shared/stores/selectors/advisor-selectors.ts` — replaced the old component-level advisor `useMemo`). N consumers cost one `computeAdvisorPipeline` call; writes to unrelated fields (`heroName`, toast) trigger zero recomputation — preserving the `energySwitchPoint` invariant (proven at selector level in `advisor-selectors.test.ts:50-58`, not via a hero-name text input — P-01 is unreachable in the shipped UI, see [`../.specs/features/modular-architecture-w8-measure-close/perf-comparison.md`](../.specs/features/modular-architecture-w8-measure-close/perf-comparison.md)).
4. After a hero save, call the roster slice's `patchHero` action (`src/shared/stores/slices/roster-slice.ts`) — it patches in place via `patchHeroInList` (`shared/lib/storage.ts`). Do not `setHeroes(loadHeroes())` unless the list identity actually changed (import/delete/new). Applies to autosave **and** manual save.
5. Never define components inside render — lint-enforced via `react/no-unstable-nested-components` at `error` (`eslint.config.mjs`).
6. **Do not add new hand `memo`/`useCallback`.** The Compiler owns render memoization going forward. The one existing exception is `memo(SlotEditor)` — see the W8 finding below. Adding a new hand boundary needs the same profiler A/B this rule required before removing one.
7. Keep pure math in `src/shared/domain/*`; React stays thin.
8. Profiler checks before merge when touching hot paths: type attack, type gear slot, sort roster, switch planner tab (`P-02`…`P-05`). Compare `componentRenders` + duration against a **same-session control** per [`perf-comparison.md`](../.specs/features/modular-architecture-w8-measure-close/perf-comparison.md)'s method — do not eyeball it, and never compare across sessions.

9. **Pick the right instrument, and say which one you used.** Two exist and their numbers are not interchangeable:

   | Mode | Command | What it measures | Use it for |
   | --- | --- | --- | --- |
   | `dev-strict` | `PERF=1 pnpm perf:capture` (Docker) or `:host` | `next dev` + StrictMode | continuity with the W1/W5/W8 baselines |
   | `prod-profile` | `pnpm perf:build:profile` then `pnpm perf:capture:profile` | production React, component names retained | **any claim about production behavior** |

   Measured difference between them on the same tree: `componentRenders` is **byte-identical**, but `dev-strict` durations run **2.9×–5.7× slower**. So a render-count finding from `dev-strict` transfers to production; a **duration** finding does not. Baseline and full comparison: [`perf-prod-profile-baseline.md`](../.specs/prds/planner-residuals/perf-prod-profile-baseline.md).

   The profiling build is unminified so names survive — never judge **bundle size** from it.

```tsx
// ❌ BAD — bare pipeline object as dep; any store write invalidates
useMemo(() => computeAdvisorPipeline(inputs), [inputs]);

// ✅ GOOD — selectAdvisorPipeline(state) (memoized selector; do not wrap in useShallow)
const pipeline = usePlannerStore(selectAdvisorPipeline);
```

## Rule 6 — `memo(SlotEditor)` is required, not redundant (W8 finding, closed)

This was open since the Compiler landed: keep hand memoization "until profiler proves them redundant." **W8 ran that proof.** The result is durable — do not re-open it without new evidence of the same rigor.

**Every `memo(`/`useCallback(` hit in the shipped tree was inventoried and judged** — full detail in [`memo-retirement-ledger.md`](../.specs/features/modular-architecture-w8-measure-close/memo-retirement-ledger.md). Two `memo()` boundaries existed:

- **`memo(SlotEditor)` (`src/features/gear/components/slot-editor.tsx`) + its feeding `setSlot` callback — KEEP, proven required.** A paired A/B (control: boundary present; variant: both wrappers removed, nothing else changed) measured **P-02 (type in attack) go from 4339 to 7394 `componentRenders` — +3055, +70% — and commit duration +53.0%**, ten times over the ≤5% guard. Root cause: `GearTab` re-renders on every P-02 keystroke (it subscribes to `state.gearedOverride`, which P-02 writes directly) even though `loadout` never changes on that path; with the memo + a referentially-stable `setSlot` in place, all 8 `SlotEditor` instances under `GearSlotsGrid` currently bail out on every one of those re-renders because no prop changes identity. Remove either wrapper and all 8 render on every keystroke. **This boundary protects an interaction unrelated to its own name** (typing a stat value on the same tab, not changing a gear slot) — exactly why "no scripted interaction touches it" or "its own interaction improved" are not sufficient evidence; the *other* gated scenarios are what condemned or cleared it. Full numbers: ledger `MEMO-01`/`MEMO-02`.
- **`memo(RosterRow)` (`src/features/roster/components/roster-row.tsx`) + its feeding callbacks — KEEP, unreachable.** `RosterTable` (the only consumer) has zero importers anywhere in the shipped tree — a dead component path, not a live boundary. No A/B is possible or meaningful; this is a dead-code finding, not a memo-redundancy finding, and dead-code removal is separately out of scope ([`architecture.md`](architecture.md)'s feature-slices section). **This is not the same claim as "kept pending proof"** — there is no scripted interaction, or any interaction at all, that could ever exercise it while the tree stays dead.

The remaining 20 `useCallback` hits either feed no `memo()` consumer at all (an unmemoized child re-renders identically regardless of prop-reference identity, so there is no boundary redundancy to prove or disprove) or are non-render-stability callbacks — context-value identity (`tooltip-root.tsx`, `tabs-root.tsx`) or an effect/subscription dependency (`use-tabs-panels-height.ts`) — which rule 6 never covered in the first place (those are correctness devices, not memoization). **Zero retirements landed.** Ledger summary: 22 KEEP, 0 RETIRE.

**Forward rule, unchanged:** no blanket deletion of the surviving boundaries, and no new hand `memo`/`useCallback` added without the same per-boundary profiler A/B this finding required — the Compiler owns memoization for everything that hasn't already earned an exception the hard way.

## Layout

Composer / feature-slice / shared-layer ownership: see [`architecture.md`](architecture.md).
