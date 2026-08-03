# Architecture

**Status:** hard truth
**Sources:** modular-architecture programme W1–W7 (`app/` + `features/` + `shared/` layered tree, lint-enforced boundaries, Zustand root store); app shell ADR [`adr/013-app-shell-route-group.md`](adr/013-app-shell-route-group.md); performance rules in [`react-performance.md`](../../../docs/react-performance.md); design-system layout in [`design-system.md`](../../../docs/design-system.md); state rules in [`state-management.md`](state-management.md); naming rules in [`naming.md`](../../../docs/naming.md)

Rewritten for the post-W7 tree (`MOD-38`). Every path below was verified against the shipped repo, not carried forward from an earlier draft.

## The three layers

```
src/app/       → routes, layout, client shell. Composes features; owns nothing domain-specific.
src/features/  → feature slices. May import shared/. MUST NOT import another feature (lint error).
src/shared/    → cross-cutting. MUST NOT import app/ or features/ (lint error).
```

Dependency direction is one-way and downward: `app` → `features` → `shared`. `shared` code never imports upward, and a feature never reaches sideways into another feature — both are enforced by ESLint, not just convention (see **Lint enforcement**, below).

### Entry (`src/app/`)

- **`src/app/(app)/layout.tsx`** wraps every user route in `ClientAppShell` — a single **client mount gate** (`ClientMountGate`), shared header/footer/lang, the import dialog, and the `@planner` parallel slot. Do **not** add per-page mount gates.
- **`src/app/(app)/@planner/default.tsx`** renders `@/features/planner` and stays mounted (hidden + `inert`) while browsing `/phases` — the planner never remounts on navigation.
- The mount gate hydrates the Zustand planner store (`hydratePlannerStore()`) and attaches persistence *before* the `@planner` slot mounts. Do **not** use `next/dynamic(..., { ssr: false })` — Next 15.5 surfaces that as `BAILOUT_TO_CLIENT_SIDE_RENDERING` and can blank the page (AD-012).
- `src/app/_shell/` holds the shell itself: `client-app-shell.tsx`, `client-mount-gate.tsx`, `app-shell-inner.tsx`, `site-header.tsx`, `topbar.tsx`, `footer.tsx`, `guide-section.tsx`, `clarity.tsx`, `site-nav-link.tsx`.
- Composer (`src/features/planner/components/hero-planner.tsx`) is **layout compose + wiring only** — 46 lines today. There is no numeric line-budget target for the composer specifically; it is enforced the same way every other component file is (see **Lint enforcement**).

### Feature slices (`src/features/`)

Six feature slices, each with a required `index.ts` public-API barrel — nothing outside a feature may deep-import past that barrel (`boundaries/entry-point`, error):

| Slice | Owns |
| --- | --- |
| `planner/` | Composer, tab stage (`PlannerTabs`), per-tab panels (Abilities / Gear / Account / Points), hero-draft action hooks, `planner-tab` model |
| `account/` | Account column — house/level, skill tree, team buffs |
| `gear/` | `SlotEditor`, gear slots grid, gear domain UI |
| `roster/` | Roster table / sort / open-state hooks (see the dead-code note below), hero picker |
| `phases/` | Phase explorer + phase page-state model |
| `import/` | Import-heroes dialog |

**Dead-code note (recorded, not removed — out of this doc's scope to fix):** `RosterTable`/`RosterRow`/`useRosterSort`/`useRosterOpen`/`roster-table-head.tsx` under `features/roster/` are exported from `roster/index.ts` but have zero importers anywhere in `src/app/**` or `src/features/**`. The live "switch hero" UI is `HeroPickerDialog` → `HeroPickerTable` → `HeroPickerRow`, a separate, unmemoized sibling. This was found and recorded during W8's memo-retirement inventory (private planning archive) — dead-code removal is a separate concern from memo retirement and is not this wave's scope.

**Allowlisted cross-feature edges (residual, dated):** four cross-feature imports are still lint-allowlisted rather than eliminated — `planner → gear` (`GearTab`/`SlotEditor`), `planner → account` (`AccountColumn`), `planner → roster` and `phases → roster` (both reach `HeroPickerDialog`). Each is a named, dated exception in `eslint.config.mjs` (`boundaries/element-types`), not a silent gap — the default for every other feature pair is `disallow`.

### Shared layer (`src/shared/`)

| Folder | Admits | Rejects |
| --- | --- | --- |
| `design-system/` | Presentational primitives with no game-domain knowledge (now `@bombfarm/ui`) | Anything importing `@bombfarm/domain` or a feature |
| `game-art/` | Game-aware presentational components — icons, art frames, gold-value display that couple game type data (rarity, item type) with rendering | Generic (non-game) primitives → `@bombfarm/ui`; game math → `@bombfarm/domain` |
| `stores/` | State read or written by **two or more** features, or persisted to `localStorage` | State only one feature reads → `useState` in that feature (MOD-13) |
| `domain/` | Pure functions over game types, zero React, unit-testable in isolation (now `@bombfarm/domain`) | Anything importing React or `shared/stores` |
| `i18n/` | User-facing strings, split by namespace | Game term maps stay in `@bombfarm/domain` game-labels ([`i18n.md`](../../../docs/i18n.md)) |
| `lib/` | Generic utilities with no game meaning (`cn`, `format-number`, `storage.ts`) — may reach `domain/` only because the storage adapter carries game types through its call signatures | Anything with independent game meaning → `domain/` |
| `context/` | Thin compat hooks bridging to the store with no App Router provider tree | New provider-based state — the store is the cross-feature mechanism now, not React Context |

**Promotion rule.** New code is born inside the feature that needs it. The moment a **second** feature needs the same component/hook/helper, it moves down into `shared/` — not before (premature sharing is how the pre-refactor `src/lib/` grew to 30 files). Promotion is **forced, not optional**: a cross-feature import is an ESLint error (`boundaries/element-types`, error), so the only way to share code between features is to move it down through an admission test above. `shared/` is not a dumping ground — code that fails every admission test above stays in a feature.

### Lint enforcement (the rules that make the diagram real)

Both are `error` in `eslint.config.mjs`, not aspirational:

- **`boundaries/element-types`** — declares `app`, `feature` (captured per-slice), and the seven `shared-*` types above, then whitelists exactly the edges this section describes (`app → features/shared-*`, `feature → shared-*` only, `shared-design-system → itself + shared-lib` only, `shared-domain →` itself/`i18n`/`lib` only, never React or a feature). Everything not explicitly allowed is `disallow` by default.
- **`boundaries/entry-point`** — every feature's public surface is its `index.{ts,tsx}`; every `shared/design-system` and `shared/game-art` module's surface is its `index.ts` (plus `*.recipe.ts` for design-system, a DS-05 carve-out); `shared/domain`, `shared/i18n`, `shared/lib`, `shared/context`, `shared/stores` allow `**` (deep imports OK — no single-barrel requirement there).

File-size lint budgets (also `error`, not a "rough target"): general `src/` file cap **300 lines**; `src/features/**/components/**` and `src/app/_shell/**` **200 lines**; hook files (`src/**/use-*.ts`) **150 lines**. Two named, reviewed overages remain allowlisted: `src/tests/**` (**650**, comprehensive fixture-driven Vitest suites — splitting is out of scope and `MOD-03` forbids touching assertions to shrink a suite) and `src/shared/lib/storage.ts` (**350**, a pre-existing persistence/migration module, not touched by the component-decomposition waves).

## Routes

- `/` — Hero planner (import-only roster, tab stage: Abilities / Gear / Account / Points). Workspace lives in the `@planner` slot.
- `/phases` — Phase explorer (wiki snapshot + roster-aware intel). Phase picker is **independent** of the account's farm phase until the user clicks **Use as farm phase** (`src/features/phases/model/phases-page.ts` → `bf-hp-account-v1`). The planner slot stays mounted but hidden.

Top nav (`SiteHeader` in the shell): **Planner · Phases**.

## Store shape

One root store (`src/shared/stores/planner-store.ts`), composed of five named slices under `src/shared/stores/slices/` — not five separate stores. `subscribeWithSelector` is always the outer middleware; `devtools` is gated behind a `NODE_ENV !== 'production'` check (see the residual finding below).

| Slice | Owns |
| --- | --- |
| `session` | lang, toast, persist gate / skip-toast one-shots |
| `account` | house/level, skill tree, team buffs, farm context |
| `roster` | heroes + `activeHeroId` — the sole in-memory roster |
| `phases` | explorer view phase (`bf-hp-phases-view-v1`) |
| `hero-draft` | active hero edit fields |

**Selectors are the public read API** (`src/shared/stores/selectors/`, one file per slice-family plus `advisor-selectors.ts` and `tab-status-selectors.ts`). A bare `usePlannerStore()` call with no selector is forbidden (subscribes to everything); every read goes through a named selector or an inline field selector. Selectors returning objects or arrays use `useShallow` — except **`selectAdvisorPipeline`**, which is a module-level, single-entry **memoized selector** over a 25-member dependency tuple that already returns a stable object identity on cache hits; wrapping it in `useShallow` would shallow-compare ~40 fields on every store write and defeat the memoization. Full rules: [`state-management.md`](state-management.md).

Persistence is `localStorage` only, via `src/shared/lib/storage.ts`, driven by explicit `subscribeWithSelector` subscriptions in `src/shared/stores/persistence/` — **not** `zustand/persist` (confirmed zero matches for `zustand/persist` in `src/`; W8 bundle-delta notes live in the private planning archive). No game-server / Electron / memory readers exist in this app package. Public-save compatibility: [`local-data-compat.md`](local-data-compat.md).

**Residual finding (recorded, not fixed here — out of scope for a docs-only wave):** the `devtools` production guard does not actually tree-shake. `planner-store.ts` imports `devtools` unconditionally at module top and only skips *calling* it under `NODE_ENV === 'production'`; webpack's tree-shaking decides module inclusion from the unminified import graph before Terser folds that now-constant branch, so the whole `devtools` module still ships to production (confirmed present in the shipped bundle — W8 bundle-delta notes in the private planning archive). Byte cost is small (≈1.5 kB gzip) and does not blow any bundle budget, but the guard should eventually become a real conditional import.

## MOD-05 — package extraction (landed in MP1)

`shared/design-system/` and pure domain math now live as workspace packages `@bombfarm/ui` and `@bombfarm/domain`. Web imports them via `workspace:*`; desktop continues to consume `@bombfarm/ui` (`AppShell`). Layering rules for package paths are still being re-wired in ESLint (tracked under `mp1-ci-vercel-rebrand`).

## Ownership rules

1. Colocate UI state in the leaf/shell that owns it — not the root composer (see [`react-performance.md`](../../../docs/react-performance.md)).
2. Pure math stays in `@bombfarm/domain` (`packages/domain/src` — `model/`, `gear/`, `stat-breakdown/`, `derive.ts`, `advisor-pipeline.ts`, `phases.ts`, `phase-wiki.ts`, `phase-intel.ts`, `game-labels.ts`, …). Wiki phase rows ship as `packages/domain/src/data/phase-wiki.json` (sync via research wiki-sync). React stays thin. When that math (or the panels it names) changes, keep the explain tab in sync — see [`explain-math.md`](explain-math.md).
3. Prefer `@base-ui/react` for interactive primitives over inventing new button/dialog APIs.
4. Prefer `@/` path aliases for imports.
5. Main workspace is a **full-width tab stage** (`PlannerTabs`: Abilities / Gear / Account / Points) — not a two-column build|advice panel stack.
6. Per-tab soft/warn chrome is pure logic in [`packages/domain/src/planner-tab-status.ts`](../../../packages/domain/src/planner-tab-status.ts) (`computePlannerTabStatuses`); UI shows a **dot + DS Tooltip** for the active hero's own trust/setup state — never an in-flow banner for that ([`animation.md`](../../../docs/animation.md) rule 8 carves out one narrow, reviewed exception for roster-scoped advice about other heroes; it does not apply to per-tab chrome). Matrix: **Hero** soft = default sheet and/or unspent ability points; **Gear** soft = no items — no warn tier (Stats moved to Points and is read-only there, so Gear no longer flags a sheet mismatch); **Account** never badges (skill tree ×1 is a valid default); **Points** soft = missing gear/sheet and/or unspent points (`level − spent`), warn = the Tier-1 reset gate recommends a points reset (`resetAdviceRecommend`, ≥1% sustained DPS gain — see [`explain-math.md`](explain-math.md)/`reset-advice.ts`).
7. **Lang + import chrome** — the session slice owns `lang` and `importDialogOpen`; `useAppLang()` is a thin store-backed compat hook (no provider). Shell import dialog and phases/planner consumers read roster + draft via store selectors.
8. Cross-feature / persisted state lives in `src/shared/stores/` (see [`state-management.md`](state-management.md)). Editable hero draft lives in the `hero-draft` slice.
9. Compound design-system primitives (`Dialog`, `Collapsible`, `Accordion`, `Tabs`, `Tooltip`, `DataTable`) are directories, one file per part plus a namespace `index.ts` — see [`design-system.md`](../../../docs/design-system.md) for the full convention (AD-021).
