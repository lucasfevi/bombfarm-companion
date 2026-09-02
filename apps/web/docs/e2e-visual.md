# Playwright e2e + visual regression

Browser-level smoke and visual baselines for the static export. Unit math stays in Vitest (`pnpm test`); this suite is separate so the fast gate stays fast.

> **Visual suite temporarily skipped** (`test.describe.skip` in `e2e/visual.spec.ts`).
> The `visual-e2e` / required `e2e-visual` jobs still run and pass (all specs skipped) so
> branch protection is not blocked while UI churn continues. Re-enable by changing
> `describe.skip` → `describe` after reviewing/updating `e2e/__screenshots__/`.
> Smoke e2e remains required and active.
>
> **Why it stayed skipped through the `birth-stats-points-reset` Wave 6 UI pass**:
> that wave changed the DOM on purpose across most panels — exactly the case where blind
> baseline acceptance is worst, since a whole-set diff carries no signal. Its own e2e coverage
> moved to Playwright smoke specs (role / accessible name / text / class assertions) plus the
> existing `thead th` box-metrics check for CLS, both of which fail with a diagnosable message
> where a screenshot only fails with a picture. `e2e/__screenshots__/` was asserted
> byte-unchanged (`git diff --exit-code`) rather than treated as a passing gate.
>
> **Version chrome (m15-release-automation):** the persistent footer now renders
> `data-testid="app-version"`. When the visual suite is re-enabled,
> `empty-workspace.png` will include that chrome — `visual.spec.ts` masks the
> element so baselines stay byte-stable until a human review pass accepts the
> updated screenshot.
>
> column, Optimize-build result line, ±5 steppers, Luck row), the HeroStrip warn border and its
> tab-switch activation, the Effective-stats panel and sheet table's Luck row and 2 dp precision
> sweep, the stat-breakdown ledger's four-line grouping, the Abilities tab's granted/spendable
> and dead-points line, the import dialog's checkbox-free layout and sync summary, and the
> updated quick-guide copy. All of it is currently covered by smoke specs only.
>
> **`/team-plan` (roster gear optimizer):** no committed visual baseline yet. The visual
> project remains globally `describe.skip`; agents may not run `test:e2e:update` or accept
> baselines. Before enabling `e2e/visual.spec.ts` for this route, a human should review:
> empty states (no roster / no inventory / all leave alone), the three-column scope board
> (desktop DnD; mobile per-card Select), Search setup (Min forge (+) + Build team plan), the
> optimizing modal (hero6 bomb-activation loop, Cancel), post-run Run summary (plain-language
> seed + elapsed seconds) + gain scoreboard / waterfall (no Today `+0`; no negative respec
> recommendation) + expandable per-hero rows with proposed gear (including kept existing
> items labeled as no-change) and point-reset details, and
> disclosures callouts. The Team plan page does not write heroes (no alt-loadout push). Smoke
> coverage lives under `e2e/team-plan-*.spec.ts`.
>
> **`/farm` (Farm Ranking board):** no committed visual baseline, same `/team-plan`
> precedent — the visual project stays globally `describe.skip` and agents may not run
> `test:e2e:update` or accept baselines. Before enabling `e2e/visual.spec.ts` for this route, a
> human should review: the rotation-pool chip row, the four filter controls (unlocked-only,
> feasible-only, difficulty, gate) and the return-bonus `Select`, the 13-column table (`table-
> fixed` + `<colgroup>`, gate/push-target/infeasible badge chips, the sortable-header chevrons
> and `aria-sort`), and the four empty/error states (no roster, zero heroes enabled,
> compute failed, zero filter matches — each renders zero numeric cells, never a table of
> zeros). Also worth a human pass: the `/phases` redirect stub's brief flash before
> `router.replace('/farm')` fires. Smoke coverage lives in `e2e/farm-ranking.spec.ts` (11
> scenarios plus a keyboard-operability pass) and the two edited pre-existing specs
> (`e2e/phases-page.spec.ts`, `e2e/app-shell-nav.spec.ts`).
>
> **`/farm` (Farm Respec Advisor):** no committed visual baseline, same `/team-plan` and `/farm`
> Ranking board precedent above — the visual project stays globally `describe.skip` and agents may
> not run `test:e2e:update` or accept baselines. Before enabling `e2e/visual.spec.ts` for this
> surface, a human should review: the toolbar (objective `Select`, Optimize button idle/busy
> states, the lower-bound headline), the panel expanding in place above the table (metric tiles,
> the plateau band with its markers and range sentence, the chest-objective explainer), the
> hero-card grid (a changed hero's eight-key table, the Luck "keep" chip, an unchanged hero's
> de-emphasized two-line card), the cost frontier list, and the re-rank banner + `Switch` sitting
> above the table. Smoke coverage lives in `e2e/farm-respec.spec.ts` (nine scenarios).
>
> **Promote-to-600 evidence:** a lightweight same-session
> Playwright timing (not the formal profiler-re-run `e2e/perf/` commit-instrumentation harness — recorded
> here as an evidence artifact, not a threshold gate) clicked the unlocked-only filter off
> (42 -> 600 rows) and back on (600 -> 42 rows) on the same page, three repetitions, host
> `dev-strict`: promote averaged **~273ms** (250/276/294ms), the same-session control (the
> reverse direction) averaged **~63ms** (62/69/59ms). No visible stall; `content-visibility:
> auto` on body rows is doing its job. If this regresses beyond a few hundred ms in a future
> measurement, the pre-decided fallback is a "show all" pager over the same pure row
> array — not a virtualization dependency.

**Local e2e runs in Docker** — same Ubuntu + Chromium stack as CI. Any machine (Windows, macOS, Linux) produces identical pixels when you run the scripts below. CI is a verification gate: if you ran the local workflow, the PR checks should pass.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux) **running**
- First run builds `bombfarm-companion-web-e2e:local` from `e2e/Dockerfile` (Playwright version pinned to `@playwright/test` in `package.json`)

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm test:e2e` | **Full suite** — smoke + visual, in Docker (matches CI) |
| `pnpm test:e2e:smoke` | Behavioral / smoke specs only |
| `pnpm test:e2e:visual` | Visual baseline specs only |
| `pnpm test:e2e:update` | Refresh changed snapshots in Docker — **review diffs first** |
| `pnpm test:e2e:report` | Open local `playwright-report/` comparator (expected / actual / diff) |
| `pnpm test:e2e:docker:build` | Rebuild the local e2e Docker image (after Playwright bump) |
| `pnpm test:e2e:host` | Run on the host OS — smoke iteration only; **do not commit host visual snapshots** |
| `pnpm test:e2e:report:ci` | Download the merged CI report (with traces) and open locally |
| `pnpm test:e2e:report:ci:url` | Print the published online report URL — no download |

Combined gate (not wired into `pnpm test`):

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

## Workflow (feature → PR)

1. **Work on the feature** — use `pnpm test:e2e:host:smoke` for a fast native smoke loop while iterating.
2. **Run the full gate locally** — `pnpm test:e2e` (Docker).
3. **If visual tests fail** — `pnpm test:e2e:report` and review every expected / actual / diff in the HTML report.
4. **Decide per snapshot:**
   - **Intentional UI change** → `pnpm test:e2e:update`, re-run `pnpm test:e2e`, commit accepted PNGs under `e2e/__screenshots__/`.
   - **Bug / accidental drift** → fix the product or test; do **not** update the baseline.
5. **Push the PR** — CI re-runs the same Linux Chromium suite. It should pass if step 4 is green locally.

Agents must **not** run `test:e2e:update` or commit screenshot changes until a human has reviewed the diffs (or explicitly approved that specific update).

## How it runs

### Local (Docker — source of truth for baselines)

`e2e/scripts/docker-run.mjs` mounts the repo, uses a **Linux `node_modules` volume** (so host Windows/macOS deps are untouched), then:

1. `pnpm install --frozen-lockfile`
2. `pnpm exec playwright install --with-deps chromium`
3. `pnpm build:e2e`
4. `CI=1 E2E_PREBUILT=1 pnpm exec playwright test …`

Playwright serves `out/` via `e2e/scripts/serve-static.mjs` (port **4321**), same as CI.

### CI (`.github/workflows/e2e-web.yml`)

Same test commands on `ubuntu-latest`; build artifact shared across smoke shards. Every test job writes a **blob report**; the `report` job merges all of them — 2 smoke shards + visual (when run) — into **one** HTML report.

**Review CI diffs:**

1. The **PR comment** names each failing screenshot and which of expected / actual / diff exist.
2. `pnpm test:e2e:report:ci` — downloads the single **`e2e-report`** artifact and opens it locally. It carries the merged report with the full Playwright comparator (expected / actual / diff slider), every diff image, and the **traces**.

Reviewing a diff means downloading that artifact; the comment cannot show one. Rendering an image inline needs an `https` URL that outlives the comment, so it would mean hosting the images somewhere. Base64 is not the way around that — GitHub's markdown sanitizer strips `data:` URIs from job summaries and comments alike, so inline base64 always renders broken.

### Projects

- **`smoke`** — all specs except `visual.spec.ts`
- **`chromium`** — visual baselines only (name keeps `*-chromium.png` suffix)

Both use `colorScheme: 'dark'`, viewport `1280×800`, DSR 1, `reducedMotion: 'reduce'`, seeded fixtures, pinned `bf_lang`.

## CI layout

| Job | Role |
| --- | --- |
| `changes` | Path filter — skips e2e when only unrelated files change |
| `build-e2e` | Single `pnpm build:e2e` → artifact `e2e-static-out` |
| `smoke-shard` | Matrix **2** shards — smoke project → blob report |
| `visual-e2e` | Visual project on `develop`/`main` (or PR label `visual-ci`); specs may still be `describe.skip` → blob report |
| `report` | On failure: merge all blobs → upload one artifact, upsert PR comment |
| `report-resolved` | On green: rewrite the PR comment so an approved run stops showing stale diffs |
| **`e2e-smoke`** | Required gate |
| **`e2e-visual`** | Required gate |

Artifacts: `e2e-static-out` (build input, 1 day) and **`e2e-report`** (merged report + all diffs, 14 days). The per-shard `blob-*` / `diffs-*` artifacts are deleted by the `report` job once merged, so a failed run leaves one report zip to download — not one per shard.

Branch protection: require **`e2e-smoke`** and **`e2e-visual`**.

## Compare tool

Playwright’s HTML report is the comparator (expected / actual / diff).

**Locally** after `pnpm test:e2e` fails:

```bash
pnpm test:e2e:report
```

**From CI:**

1. PR comment → which screenshots failed, and which of expected / actual / diff exist
2. `pnpm test:e2e:report:ci` → the full comparator for every shard, the diff images, and the traces

Pass extra Playwright args through Docker:

```bash
pnpm test:e2e -- --grep "advice column"
pnpm test:e2e:visual -- e2e/visual.spec.ts
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Docker not running | Start Docker Desktop; retry |
| Stale Linux deps after lockfile change | `docker volume rm bombfarm-companion-web-e2e-node-modules` then re-run |
| Playwright version bump | `pnpm test:e2e:docker:build` |
| Need CI diffs without local Docker | `pnpm test:e2e:report:ci` — the comment names the diffs, it cannot show them |
| Diff images render broken in a comment | Expected; there is nowhere hosting them. `data:` URIs will not work either — GitHub strips them |
| Need traces from CI | `pnpm test:e2e:report:ci` — the artifact carries them |

## Approving diffs from the PR

Once you have reviewed every diff in the downloaded report:

- **Accept** — add the **`update-snapshots`** label to the PR. [`e2e-update-baselines.yml`](../.github/workflows/e2e-update-baselines.yml) regenerates the Linux Chromium screenshots on the runner, pushes them to the branch, removes the label, and comments the commit SHA. The next e2e run turns the PR comment green.
- **Reject** — fix the product or the test. Do not label.
- **Offline equivalent** — `pnpm test:e2e:update` (Docker), then commit `e2e/__screenshots__/`.

The label path does not work on fork PRs (CI cannot push to the head repo); use the local path there.

Agents must **not** run `test:e2e:update`, apply the label, or commit screenshot changes until a human has reviewed the diffs.
