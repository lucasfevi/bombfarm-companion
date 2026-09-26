# State management

**Status:** hard truth — accepted 2026-07-30 (hard-truth promotion)  
**Sources:** the store-foundation work, and the persistence requirements it was written against

Convention for the Zustand store migration. Written so that migration could implement against a single doc; promoted per [`hard-truths.md`](../../../docs/hard-truths.md).

## Store vs `useState`

State enters the store only if it is (a) read/written by two or more features, or (b) persisted. Purely local ephemeral UI (open dropdown, sort direction) stays `useState` in the owning component. This restates [`react-performance.md`](../../../docs/react-performance.md) rule 1 — it does not supersede it.

**Makes real:** the store's first slices own session + account + roster + phases; hero-draft followed on its own.

## Slice ownership and actions

One root store (`src/shared/stores/planner-store.ts`) composed of named slices, each in its own file under `src/shared/stores/slices/`. Middleware: `subscribeWithSelector` always; `devtools` is **applied** in development only, behind a `process.env.NODE_ENV === 'production'` guard in `withOptionalDevtools`.

> **Measured correction.** `devtools` is **not** tree-shaken from the production bundle. `planner-store.ts` imports it at the top level, so the module ships even though the guard prevents it being applied — `__REDUX_DEVTOOLS_EXTENSION__` is present in the production chunk. Behavior is correct (devtools never activates in production); the cost is bundle bytes. An earlier draft of this section claimed the import was tree-shaken; that claim was false and is retracted. Fixing it needs a dynamic import or a build-time define — residual risk recorded historically outside this repo.

Each slice exports its state type, initial state, and actions. Actions are **verb-first** and colocated with the state they mutate. No slice file imports another slice file; cross-slice reads happen in selectors or in the store creator.

| Slice | Notes |
| --- | --- |
| session | lang, toast, persist gate / skip-toast one-shots |
| account | tree, farm context |
| roster | heroes + activeHeroId — sole in-memory roster |
| phases | explorer view phase (`bf-hp-phases-view-v1`) |
| hero-draft | active hero edit fields — added after the other four |

## Selector discipline

Bare `usePlannerStore()` with no selector is forbidden — it would subscribe to everything. All reads go through a named selector (or an inline field selector). Selectors that return objects or arrays use `useShallow`. ESLint enforces the bare-call ban at **error**.

**`selectAdvisorPipeline` carve-out:** do **not** wrap `usePlannerStore(selectAdvisorPipeline)` in `useShallow` — the selector already returns a stable object identity on cache hits; shallow-comparing ~40 pipeline fields on every store write would defeat the point of memoizing it.

## Memoized advisor selector

`selectAdvisorPipeline` is a **module-level single-entry** memoized selector over the current proven 25-member dependency tuple (`readAdvisorDepTuple`), returning a **stable object identity** when inputs are unchanged. N consumers cost one `computeAdvisorPipeline` call; writes to unrelated fields (`heroName`, toast, sort) trigger zero recomputation — preserving the `energySwitchPoint` invariant from [`react-performance.md`](../../../docs/react-performance.md). Reset cache in Vitest via `resetAdvisorPipelineCache()` / `resetAdvisorPipelineComputeCount()` (client-only mount gate; one store instance).

## Object identity on write

Slice actions that set object-valued fields (`naked`, `loadout`, `abilities`, `pts`, …) compare with `Object.is` and return the previous state when equal — so persistence subscriptions and the advisor cache do not re-arm on no-op writes.

## Staged-draft bridge (temporary)

~~Until the store owns hero-draft…~~ **Deleted once it did** — hero persistence subscribes directly to draft fields via `selectHeroDraftTuple` in `persist-hero-draft.ts`.

## Persistence — no `zustand/persist`

**`zustand/persist` MUST NOT be used.** Persistence goes through the existing storage adapter (`src/shared/lib/storage.ts`) driven by explicit `subscribeWithSelector` subscriptions in `src/shared/stores/persistence/`.

Structural reasons (three keys, normalize-every-load, write-back-on-read, cross-key hydration, gated debounce) are evaluated in the programme notes — **do not restate the comparison table**.

**Sanctioned upgrade path:** if `persist`'s lifecycle ergonomics are wanted later, wrap a custom `StateStorage` that reads/writes the **existing keys** — no save-key migration. Not part of the store migration.

## Two write channels

1. **Immediate writers** — roster mutations (`upsert` / delete / active id / import) write through slice actions → storage mutators that take an in-memory roster (no full-roster reload on write).
2. **Debounced subscriptions** — account tree and hero draft fields flush after the same debounce windows the pre-store effects used; boot lock and skip-toast one-shots gate success toasts.

Failed `localStorage` writes return `false`, notify `onStorageWriteError`, and surface `toastSaveFailed` — they must not throw into React.

## Hydration order

`hydratePlannerStore()` runs once in the client mount gate **before** the planner slot mounts, in a fixed order: roster → active id → account → phases view. Clean loads write nothing; prune / legacy / account-seed paths may write back through the same adapter.

## The ≤8 props rule (strict)

The store-migrated planner components (`PlannerTabs`, `GearTab` — split out of the former `BuildColumn` — `AccountColumn`, `AdviceColumn`, `HeroStrip`, composer) must declare **≤ 8 props**. Repo-wide enforcement is a Vitest inventory (`src/tests/mod-17-max-props.test.ts`).

**Closed**: `ALLOWLIST_FILES` is **empty** and the rule is strict. The `Switch` / `Select` entries were removed not by changing those components but by fixing the counter — the rule counts only a component's **own non-DOM props**, excluding native HTML/ARIA attributes and surfaces inherited via `ComponentPropsWithoutRef`. The rule targets prop-drilled god-components, not DOM pass-through primitives. The migrated six must never join an allowlist.

## What the store claims (measured)

- **Claims:** `zustand` root store; session/account/roster/phases/hero-draft; explicit persistence; the roster-hydration, autosave, storage-failure, and `_bag`-removal fixes; `AppLangProvider` removed (`useAppLang` reads session); `_bag` / dual autosave effects gone; memoized `selectAdvisorPipeline`; prop bags / god-hook / `AppShellBridgeProvider` deleted.
- **Measured, and not what was predicted:** the store migration did **not** collapse render fan-out. Raw `componentRenders` moved under ±1.1% on every scenario, and the profiler re-run gate failed on two of four before a later decision recorded the raw threshold as non-comparable across the component decomposition. What the store **did** deliver is measured commit-duration improvement (−24% to −38% on three of four scenarios) plus the memoized-selector and single-write-autosave invariants. Claim the durations and the invariants; do not claim a re-render collapse.
