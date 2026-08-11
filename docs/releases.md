# Releases — changesets rail, artifacts, and recovery

**Status:** hard truth (maintainer runbook)

This repo ships through a **changesets** release rail: feature work merges to `develop`, an always-current release PR targets `main`, and merge triggers version sync plus optional desktop artifacts. See also [`branching.md`](branching.md) for branch roles and [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the contributor changeset flow.

## End-to-end flow

```text
feature PR (changeset) → merge to develop
  → release-pr.yml reconciles main into release/next, then upserts release/next → main PR
  → review bumps + CHANGELOG + CI + beta (if desktop in set)
  → human 24 h soak checklist (not a required check)
  → squash-merge release PR to main
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
7. **Squash-merge the release PR to `main`** (see [Merge strategy](#merge-strategy)).
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

## Merge strategy

**Squash-merge the release PR.** `main` is protected with `required_linear_history`, so
merge commits are rejected there and squash is the only strategy the branch accepts.
Feature PRs into `develop` are squashed too.

Squashing has a consequence worth understanding, because it caused a silent outage of the
release rail once already. A squash gives `main` a commit that shares **no history** with
the `release/next` branch it came from, so `main` permanently forks from `develop`. Left
alone, the next release PR compares across a merge base predating the whole release rail
and reports `CONFLICTING` on dozens of add/add collisions — none of them real, since
`main` is strictly behind `develop`.

The rail absorbs this itself. Before versioning, [release-pr.yml](../.github/workflows/release-pr.yml)
merges `main` into `release/next` with `-s ours`:

- `main` becomes an ancestor, so the PR is mergeable again.
- The tree is untouched — it stays exactly what `develop` produced. The merge records
  ancestry and nothing else.
- The merge commit lives on `release/next`, so squashing onto `main` still leaves `main`
  linear. Linear history and a connected rail are not in conflict.

`-s ours` discards `main`'s tree wholesale, which is only safe while every commit on
`main` came from the rail. [`tools/release/main-reconcile.mjs`](../tools/release/main-reconcile.mjs)
enforces that: it inspects every commit reachable from `main` but not from the release
branch and **fails the run** unless each one is a release squash. A hotfix landed directly
on `main` therefore stops the release loudly instead of being dropped from the next one.

If it does refuse, do not bypass it. Port the change to `develop`, or merge `main` into
`develop`, and re-run.

## Version sync and parity guard

After a release PR merges, `release-sync.yml` recreates `release/next` from the merged PR head (fetching `pull/<n>/head` so the SHA remains reachable after `delete_branch_on_merge`), opens `chore(release): sync versions to develop` (`release/next` → `develop`) with **`RELEASE_PAT`** so normal PR checks run, and enables auto-merge when the repository setting allows it.

While `develop` is **behind** `main` on package versions (sync PR pending or failed), [release-pr.yml](../.github/workflows/release-pr.yml) **skips** creating or updating the release PR and writes a job summary: *waiting on version-sync PR*. This prevents double-bumping.

If **sync PR creation** fails, the job fails loudly and prints manual commands. Fix the sync PR before the next release run.

**Auto-merge is best-effort and never fails the job.** GitHub only accepts
`enablePullRequestAutoMerge` while a PR is blocked by a pending required check, so calling
it immediately after creating the sync PR is a race — the checks have not registered yet
and GitHub answers `Pull request is in unstable status`. The step retries while they spin
up, then falls back to a job-summary note asking for a manual `gh pr merge <n> --squash`.
The sync PR itself is already created and correct at that point, so a lost toggle must not
report the sync as failed. Auto-merge also requires `allow_auto_merge` on the repository.

## Required CI on the release PR

Release version commits and the `release/next` → `main` PR are authored with the
repository secret **`RELEASE_PAT`** (classic PAT or fine-grained token with
`contents` + `pull_requests` write) so GitHub runs normal `pull_request` checks on
that head. Do **not** use `GITHUB_TOKEN` for those steps — token-authored PRs do
not receive check runs from other workflows.

Required contexts on the release head: `ci-web-required`, `ci-desktop-required`,
`e2e-smoke`, `e2e-visual` (and `beta-installer` when desktop is in the set).

### Cost notes

1. **Windows smoke** on feature PRs is opt-in via the `windows-ci` label (always on `develop`/`main` pushes).
2. **Visual e2e** on feature PRs is opt-in via the `visual-ci` label (always on `develop`/`main` pushes when e2e paths match).
3. Smoke e2e uses **2** shards.

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
| Nightly prerelease | [nightly.yml](../.github/workflows/nightly.yml) | Manual `workflow_dispatch` from `develop` (schedule paused) |
| Beta installer | [release-pr.yml](../.github/workflows/release-pr.yml) `beta-installer` job | When desktop is in the release set (PR artifact) |
| Production | [release-prod.yml](../.github/workflows/release-prod.yml) | After merge to `main` when desktop was released |

Local packaging: `pnpm --filter @bombfarm/desktop package:nightly|beta|prod` (see root `README.md`).

## Nightly and beta access

Nightly and beta builds are published as GitHub Releases / prereleases. Testers download manually — they do **not** receive auto-updates until a production release channel is enabled.

- **Nightly:** GitHub Releases tagged `desktop-v<version>-nightly.<YYYYMMDD>.<sha7>` — download from the repo Releases page. Retention keeps the **7** newest nightlies. The scheduled nightly workflow is paused; run via `workflow_dispatch` when needed.
- **Beta:** GitHub **prerelease** (`desktop-v<version>-beta.<run>`) with all `release/beta/*` assets, plus a PR workflow artifact (`bombfarm-companion-beta-<version>-<sha7>`) and PR comment with the head SHA. A `publish_prerelease` dispatch input can force-republish an existing beta release tag.
- **Prod:** installer artifact on every qualifying `main` push; public GitHub Release only when the flag is on (below).

## Production desktop GitHub Release

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
- [changesets.yml](../.github/workflows/changesets.yml) validates frontmatter and requires a pending changeset unless the PR has the **`skip-changeset`** label. The bot release PR (`release/next` → `main`) is exempt — changesets were already consumed when that head was versioned.
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
| [nightly.yml](../.github/workflows/nightly.yml) | Manual dispatch | Nightly desktop prerelease (schedule paused) |
| [release-prod.yml](../.github/workflows/release-prod.yml) | `main` push | Prod desktop artifact + optional GitHub Release |
| [ci-web.yml](../.github/workflows/ci-web.yml) | push, PR, dispatch | Web quality gate |
| [ci-desktop.yml](../.github/workflows/ci-desktop.yml) | push, PR, dispatch | Desktop quality gate |
| [e2e-web.yml](../.github/workflows/e2e-web.yml) | push, PR, dispatch | Web e2e gate |

## Related

- [`branching.md`](branching.md) — `develop` / `main` roles and protection
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — changeset contributor flow
- [`.changeset/README.md`](../.changeset/README.md) — changesets quick pointer
- [`validation.md`](validation.md) — author ≠ validator
