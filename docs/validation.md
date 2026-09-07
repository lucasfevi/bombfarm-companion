# Validation (author ≠ validator)

**Status:** hard truth

The agent that **implements** (or fixes) a change must not be the one that **validates** it.

## Rules

1. After implementing or fixing, dispatch a **fresh validator subagent** — do not self-check and declare the work done.
2. The validator does not inherit the author's context, assumptions, or mental model. Give it: change surface (diff / files), the acceptance checklist for **this** delivery, and local-check commands. If a checklist conflicts with [`docs/`](README.md) or shipped code, **`docs/` and code win**; note the drift instead of “fixing” code to an outdated note.
3. The validator reports **PASS/FAIL with evidence** and does **not** fix code.
4. Gaps go back to an implementer; then re-dispatch the validator. Cap fix→re-verify at **3 rounds**, then escalate to the user.
5. Prefer evidence-or-zero against acceptance criteria; do not weaken, skip, or delete tests to make gates pass.

## Local checks (before calling PASS)

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For any change the web planner can observe — styling and layout, but equally store slices,
selectors, persistence and stored record shapes — also run:

```bash
pnpm --filter @bombfarm/web exec playwright test --project=smoke
```

**Do not read this as a visual-only gate.** It was one, and that let a state-management change
through on 2026-09-02: a stored hero field the draft slice did not mirror made the debounced
autosave churn the roster array, closing the Farm Respec panel ~700ms after the player opened it.
Nothing about it was visual, and five e2e tests were red while `typecheck`, `lint`, `build`, 7,002
Vitest tests and the Electron smoke suite were green. The e2e specs are the only check that drives
the app as a running browser app over time, which is the one axis a Vitest assertion cannot reach.

For **Storybook / design-system catalog** waves, also run:

```bash
pnpm --filter @bombfarm/ui build-storybook
pnpm --filter @bombfarm/ui test-storybook
```

Keep `pnpm test` as the fast Vitest unit gate — do not fold Playwright or Storybook into it. See [`e2e-visual.md`](../apps/web/docs/e2e-visual.md) for the Docker e2e workflow (matches CI on any host), baselines, and **review-before-update**; [`design-system.md`](design-system.md) for the Storybook catalog.

## `m2-storybook-ci` — M2 exit criterion restatement (2026-08-11)

M2's exit criterion (`plan/M2.md` in the spec repo) reads: *"Storybook builds in CI
with every §3 component represented, zero a11y-addon violations, contrast-token unit
test green; visual-regression baseline artifact stored."* Restated clause by clause,
with evidence, as amended by **AD-018**:

| Clause | Status | Evidence |
| --- | --- | --- |
| Storybook builds in CI | **PASS** | `.github/workflows/ci-web.yml`'s `design-system` job runs `pnpm --filter @bombfarm/ui build-storybook` on the `web` path filter; `design-system-required` fails the whole check if that job doesn't succeed (including `skipped`/`cancelled`) |
| Every §3 component represented | **PASS for M2's slice** | `DESIGN_SYSTEM.md` §3's own table scopes M2 to `AppShell`, `StatusChip`, `EmptyState`, `Toast`/`ProgressToast`/`NotificationCenter`, `SettingsForm` primitives, `Slider`, `Icon`, `Dialog`, `Tooltip` — every one has a story in `packages/ui/src` (`AppShell.stories.tsx`, `status-chip.stories.tsx`, `empty-state.stories.tsx`, `toast.stories.tsx` + `toast-system.stories.tsx`, `notification-center.stories.tsx`, `settings-form.stories.tsx`, `slider.stories.tsx`, `icon.stories.tsx`, `dialog.stories.tsx`, `tooltip.stories.tsx`) |
| Zero a11y-addon violations | **PASS** | `@storybook/addon-a11y` registered; `pnpm --filter @bombfarm/ui test-storybook` — 29 story suites / 107 story tests, 0 violations. 16 real violations found on first run were fixed at the root (component/recipe/story), not allowlisted — see the `fix(ui): resolve every a11y violation…` commit |
| Contrast-token unit test green | **PASS (pre-existing, reconfirmed)** | `packages/ui/src/tokens.contrast.test.ts` (TOK-09) — 7 tests, all passing under `pnpm --filter @bombfarm/ui test`. This is a distinct, narrower check than the a11y-addon violations above: it asserts fixed token *pairs* (e.g. `ink` on `bg`) meet their declared minimum ratio, not every component/state combination a story renders |
| Visual-regression baseline artifact stored | **DEFERRED — not this feature (AD-018)** | Explicit decision, 2026-08-11: cross-platform baselines (Windows dev vs Linux CI) would fail on first run, and M3 is when there are real screens worth diffing. No visual-regression work was done here |

**What AD-018 deferred, named explicitly so this exit is not overclaimed:**

- `m2-inventory-ui`, `m2-entity-panel` — component work items deferred to M3/M4 per `DESIGN_SYSTEM.md` §3's own milestone split (`ItemCard`/`ItemRow`/`RarityBadge`/… ship in M3; `EntityLink`/`DetailPanel`/`StatsDashboard` ship in M4)
- The visual-regression baseline artifact — deferred to M3

**Added CI wall-clock (SBC-23):** the new `design-system` job runs in parallel with
`quality` (both depend only on `changes`), so its net effect on total workflow
wall-clock is close to `max(quality, design-system)` rather than additive, on a
GitHub-hosted runner with spare concurrency. The job's own duration, measured locally
and extrapolated: `pnpm install` (~30-60s, cached), `playwright install --with-deps
chromium` (~20s warm cache / ~60-90s cold — the single largest variable, already an
accepted cost pattern in `e2e-web.yml`'s `smoke-shard`/`visual-e2e` jobs),
`build-storybook` (~6.5s locally, budget ~15s in CI), `test-storybook` (~15.5s
locally across 107 stories at `--maxWorkers=2`, budget ~30s in CI). Estimated total:
**~3-4 minutes**, well under the ~10 minute threshold — no sharding proposed.
