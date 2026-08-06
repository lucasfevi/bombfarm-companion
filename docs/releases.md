# Releases — changesets rail, artifacts, and recovery

**Status:** hard truth (maintainer runbook)

This repo ships through a **changesets** release rail: feature work merges to `develop`, an always-current release PR targets `main`, and merge triggers version sync plus optional desktop artifacts. See also [`branching.md`](branching.md) for branch roles and [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the contributor changeset flow.

## End-to-end flow

```text
feature PR (changeset) → merge to develop
  → release-pr.yml upserts release/next → main PR
  → review bumps + CHANGELOG + CI + beta (if desktop in set)
  → human 24 h soak checklist (not a required check)
  → merge release PR to main
  → release-sync.yml syncs versions back to develop
  → release-prod.yml (desktop artifact; GitHub Release only when flag on)
  → Vercel production deploy from main (unchanged Git integration)
```

### Maintainer steps

1. **On a feature PR into `develop`:** ensure a changeset exists (or add the `skip-changeset` label when appropriate — see [Changeset policy](#changeset-policy)).
2. **Merge the feature PR to `develop`.** The [Release PR workflow](../.github/workflows/release-pr.yml) runs on every `develop` push. The bump commit on `release/next` sets `HUSKY=0` so Actions is not blocked by local commit hooks.
3. **Open the release PR** (`release/next` → `main`) if one was created or updated. Its body lists every package bump, artifact plan, head SHA, and the pre-merge soak checklist.
4. **Review** version bumps and generated `CHANGELOG.md` entries. Confirm required CI checks are green on the release head (`ci-web-required`, `ci-desktop-required`, `e2e-smoke`, `e2e-visual`, and `beta-installer` when desktop is in the set).
5. **When desktop is in the release set:** download the beta installer from the PR workflow artifact or the upserted PR comment. Verify the build matches the head SHA shown in the report.
6. **Complete the [pre-merge soak checklist](#pre-merge-soak-checklist)** before merging to `main`.
7. **Merge the release PR to `main`.**
   - **Web:** Vercel deploys production from `main` automatically (no GitHub Actions deploy step).
   - **Desktop:** [release-prod.yml](../.github/workflows/release-prod.yml) builds a prod installer artifact when `@bombfarm/desktop` was in the release set. A public GitHub Release is created **only** when `BFC_ENABLE_PROD_RELEASE` is `true` (see [Going public](#going-public-desktop-github-release)).
8. **Version sync:** [release-sync.yml](../.github/workflows/release-sync.yml) opens and auto-merges `release/next` → `develop` so both branches carry the same versions and consumed changesets.

## Release-set matrix

The release set comes from `pnpm changeset status` (all pending changesets aggregate in one version run). Packages with bump type `none` (devDependency-only edges) are excluded.

| Release set | Version bumps | Beta installer | On merge to `main` |
| --- | --- | --- | --- |
| Web only | `@bombfarm/web` + web-side libs | Skipped — reason in PR body | Vercel prod deploy; no desktop job |
| Desktop only | `@bombfarm/desktop` + its libs | Built — PR artifact, GitHub prerelease, and `beta-installer` check | Prod installer artifact; GitHub Release only if flag on |
| Both (e.g. `packages/ui` bump) | Both apps + shared libs, one PR | Built | One merge covers web + desktop |
| Libs only | Shared packages only | Skipped | No app-specific release artifacts |
| No pending changesets | — | — | No release PR opened |

Logic lives in [`tools/release/release-plan.mjs`](../tools/release/release-plan.mjs) and is unit-tested.

## Version sync and parity guard

After a release PR merges, `release-sync.yml` recreates `release/next` from the merged PR head SHA (so version sync survives `delete_branch_on_merge`), opens `chore(release): sync versions to develop` (`release/next` → `develop`), dispatches required CI on that head, and auto-merges with squash.

While `develop` is **behind** `main` on package versions (sync PR pending or failed), [release-pr.yml](../.github/workflows/release-pr.yml) **skips** creating or updating the release PR and writes a job summary: *waiting on version-sync PR*. This prevents double-bumping.

If sync PR creation or auto-merge fails, the job fails loudly and prints manual commands. Fix the sync PR before the next release run.

## Required CI fan-out

GitHub does not run workflows on PRs opened by `GITHUB_TOKEN`. The release rail therefore **dispatches** `ci-web.yml`, `ci-desktop.yml`, and `e2e-web.yml` onto `release/next` after upserting the release PR. All three are dispatched even when the release set is web-only or desktop-only, because each workflow owns a required check context that must report on the release head.

Heavy jobs use `github.event_name != 'pull_request'` so a `workflow_dispatch` run executes the full job set (not a green-but-empty aggregator).

### Accepted consequences

1. **`e2e-web` path filter on dispatch:** `dorny/paths-filter` has no explicit `base` on `workflow_dispatch`, so it compares against the previous commit on `release/next` (typically `develop` HEAD vs the bump commit). That is the intended comparison for a release PR, but it is narrower than a full `develop`↔`main` diff.
2. **Dispatch cost:** a dispatched run consumes the same runner minutes as a push run (including Windows when desktop jobs run).

## Pre-merge soak checklist

The release PR body and job summary include a **human checklist only — not a required GitHub check**:

- Wait at least **24 hours** after the beta installer is available (when desktop is in the set).
- Exercise the desktop build.
- Confirm the changelog.

Merging before the soak is a maintainer judgment call; nothing in CI enforces the wait.

## Desktop packaging paths

Installers are **not** built on every `main` push. Packaging is exercised by:

| Path | Workflow | When |
| --- | --- | --- |
| Nightly prerelease | [nightly.yml](../.github/workflows/nightly.yml) | Daily schedule (06:00 UTC) or manual dispatch from `develop` |
| Beta installer | [release-pr.yml](../.github/workflows/release-pr.yml) `beta-installer` job | When desktop is in the release set (PR artifact) |
| Production | [release-prod.yml](../.github/workflows/release-prod.yml) | After merge to `main` when desktop was released |

Local packaging: `pnpm --filter @bombfarm/desktop package:nightly|beta|prod` (see root `README.md`).

## Nightly and beta access

The repository is **private** until the desktop app is production-ready. Testers do **not** receive auto-updates.

- **Nightly:** GitHub Releases tagged `desktop-v<version>-nightly.<YYYYMMDD>.<sha7>` — download manually from the repo Releases page. Retention keeps the **7** newest nightlies.
- **Beta:** GitHub **prerelease** (`desktop-v<version>-beta.<run>`) with all `release/beta/*` assets, plus a PR workflow artifact (`bombfarm-companion-beta-<version>-<sha7>`) and PR comment with the head SHA. A `publish_prerelease` dispatch input can force-republish an existing beta release tag.
- **Prod:** installer artifact on every qualifying `main` push; public GitHub Release only when the flag is on (below).

## Going public (desktop GitHub Release)

Production desktop publishing is gated by the repository variable **`BFC_ENABLE_PROD_RELEASE`**. When unset or not `true`:

- No GitHub Release, no draft, and no tag are created.
- The workflow still uploads a prod installer **CI artifact** for verification.

Set `vars.BFC_ENABLE_PROD_RELEASE` to `true` in GitHub repository settings to enable `gh release create` with tag `desktop-v<version>`. No code change is required to flip this.

## Web production deploy

Production web deploys through the **Vercel Git integration** on `main`. There is no Vercel step in GitHub Actions and no `VERCEL_*` secret in workflows.

### Vercel failure after merge

If production deploy fails after a release merge:

1. **Do not revert the merge** solely for a Vercel failure.
2. Fix the deploy issue (build logs, env, project settings).
3. **Redeploy from `main`** in the Vercel dashboard or CLI.

Version bumps and changelogs on `main` remain the source of truth.

## Changeset policy

- Contributors run `pnpm changeset` on PRs that touch shipping paths under `apps/**` or `packages/**`.
- [changesets.yml](../.github/workflows/changesets.yml) validates frontmatter and requires a pending changeset unless the PR has the **`skip-changeset`** label.
- Use `skip-changeset` for docs-only, test-only, or CI-only changes inside a versioned package when no user-visible release is intended.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for shared-package rules.

## Version fields — never hand-edit

All workspace `version` fields and `CHANGELOG.md` bumps are produced by **`pnpm changeset version`** on the `release/next` branch. Do **not** hand-edit `version` in any `package.json` or skip the changeset flow to "fix" a number.

If versions drift between `develop` and `main`, resolve through the **version-sync PR** or the parity guard — not manual edits on both branches.

Parity assessment lives in [`tools/release/version-diff.mjs`](../tools/release/version-diff.mjs).

## Version chrome

Both apps surface their package version in persistent UI (no in-app changelog):

- **Web:** footer `data-testid="app-version"` — build-time label from `apps/web/package.json` (see [`apps/web/src/shared/app-version.ts`](../apps/web/src/shared/app-version.ts)).
- **Desktop:** shell version + flavor label when not `prod` — from `app.getVersion()` over IPC (see [`packages/contracts`](../packages/contracts/src/index.ts)).

A changesets bump updates the displayed version without additional code edits.

## Workflows index

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| [changesets.yml](../.github/workflows/changesets.yml) | PRs + `develop` push | Validate changesets; require changeset on shipping PRs |
| [release-pr.yml](../.github/workflows/release-pr.yml) | `develop` push, dispatch | Upsert `release/next` → `main` PR; beta artifact |
| [release-sync.yml](../.github/workflows/release-sync.yml) | Release PR merged to `main` | Sync versions to `develop` |
| [nightly.yml](../.github/workflows/nightly.yml) | Schedule + dispatch | Nightly desktop prerelease |
| [release-prod.yml](../.github/workflows/release-prod.yml) | `main` push | Prod desktop artifact + optional GitHub Release |
| [ci-web.yml](../.github/workflows/ci-web.yml) | push, PR, dispatch | Web quality gate |
| [ci-desktop.yml](../.github/workflows/ci-desktop.yml) | push, PR, dispatch | Desktop quality gate |
| [e2e-web.yml](../.github/workflows/e2e-web.yml) | push, PR, dispatch | Web e2e gate |

## Related

- [`branching.md`](branching.md) — `develop` / `main` roles and protection
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — changeset contributor flow
- [`.changeset/README.md`](../.changeset/README.md) — changesets quick pointer
- [`validation.md`](validation.md) — author ≠ validator
