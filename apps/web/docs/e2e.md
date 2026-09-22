# Playwright e2e

Browser-level smoke specs for the static export. Unit math stays in Vitest (`pnpm test`); this suite is separate so the fast gate stays fast.

There is no visual-regression suite: layout regressions are covered by the smoke specs' role / accessible-name / text assertions, which fail with a diagnosable message where a screenshot only fails with a picture.

**Local e2e runs in Docker** — same Ubuntu + Chromium stack as CI. CI is a verification gate: if the Docker run passes locally, the PR check should pass.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux) **running**
- First run builds `bombfarm-companion-web-e2e:local` from `e2e/Dockerfile` (Playwright version pinned to `@playwright/test` in `package.json`; the base image tag must track the one `e2e-web.yml` uses)

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm test:e2e` | **Full suite** in Docker (matches CI) |
| `pnpm test:e2e:smoke` | The `smoke` project explicitly — today identical to the full suite |
| `pnpm test:e2e:host` | Run on the host OS — fast iteration; the pixels differ from CI but the assertions do not depend on them |
| `pnpm test:e2e:host:smoke` | Host run of the `smoke` project |
| `node e2e/scripts/docker-run.mjs build-image` | Rebuild the local e2e Docker image (after a Playwright bump) |
| `node e2e/scripts/open-report.mjs` | Open the local `playwright-report/` a failed run wrote |
| `node e2e/scripts/show-ci-report.mjs` | Download the merged CI report (with traces) from the latest failed run and open it locally |

The last three have no `package.json` alias; run them from `apps/web`.

Pass extra Playwright args through Docker:

```bash
pnpm test:e2e -- --grep "advice column"
```

## Workflow (feature → PR)

1. **Work on the feature** — `pnpm test:e2e:host:smoke` for a fast native loop while iterating (`E2E_PREBUILT=1` skips the build when `out/` is current; set `E2E_PORT` if 4321 is held by another session).
2. **Run the suite in Docker** — `pnpm test:e2e`.
3. **If it fails** — `node e2e/scripts/open-report.mjs` and read the trace and error context; fix the product or the test.
4. **Push the PR** — CI re-runs the same Linux Chromium suite.

## How it runs

### Local (Docker)

`e2e/scripts/docker-run.mjs` mounts the repo, uses a **Linux `node_modules` volume** (so host Windows/macOS deps are untouched), then:

1. `pnpm install --frozen-lockfile`
2. `pnpm exec playwright install --with-deps chromium`
3. `pnpm build:e2e`
4. `CI=1 E2E_PREBUILT=1 pnpm exec playwright test …`

Playwright serves `out/` via `e2e/scripts/serve-static.mjs` (port **4321**), same as CI.

### CI (`.github/workflows/e2e-web.yml`)

Same test commands on `ubuntu-latest` in the pinned Playwright container; one build artifact shared across the smoke shards. Every shard writes a **blob report** on failure; the `report` job merges them into **one** HTML report.

**Review a CI failure:**

1. The **PR comment** links the run and names the artifact.
2. `node e2e/scripts/show-ci-report.mjs` — downloads the single **`e2e-report`** artifact and opens it locally, traces included.

The comment cannot carry the report itself: GitHub's markdown sanitizer strips `data:` URIs from comments and job summaries alike.

### Projects

- **`smoke`** — every spec outside `e2e/perf/`
- **`perf`** — the render-count harness, only when `PERF=1`

Both use `colorScheme: 'dark'`, viewport `1280×800`, DSR 1, `reducedMotion: 'reduce'`, seeded fixtures, pinned `bf_lang`.

## CI layout

| Job | Role |
| --- | --- |
| `changes` | Path filter — skips e2e when only unrelated files change |
| `build-e2e` | Single `pnpm build:e2e` → artifact `e2e-static-out` |
| `smoke-shard` | Matrix **2** shards — smoke project → blob report on failure |
| `perf` | Advisory render-count comparison, non-blocking |
| `report` | On failure: merge all blobs → upload one artifact, upsert PR comment |
| `report-resolved` | On green: rewrite the PR comment so a fixed run stops showing a stale failure |
| **`e2e-smoke`** | Required gate |

Artifacts: `e2e-static-out` (build input, 1 day) and **`e2e-report`** (merged report, 14 days). The per-shard `blob-*` artifacts are deleted by the `report` job once merged, so a failed run leaves one report to download — not one per shard.

Branch protection: require **`e2e-smoke`**.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Docker not running | Start Docker Desktop; retry |
| Stale Linux deps after lockfile change | `docker volume rm bombfarm-companion-web-e2e-node-modules` then re-run |
| Playwright version bump | `node e2e/scripts/docker-run.mjs build-image`, and move the container tag in `e2e-web.yml` with it |
| Need traces from CI | `node e2e/scripts/show-ci-report.mjs` — the artifact carries them |
| Host run tests old code | A listener on 4321 is reused as-is; kill it, or set `E2E_PORT` |
