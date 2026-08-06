# Branching — `develop` integration, `main` release-only

**Status:** hard truth (agent workflow)

This repo uses a two-branch integration model. Feature work lands on **`develop`**; **`main`** is release-only.

## Branch roles

| Branch | Role |
| --- | --- |
| `develop` | Default integration branch — feature PRs target here |
| `main` | Release-only — reachable via a release PR from `develop` or the hotfix path below |
| `feat/*`, `fix/*` | Short-lived work branches |
| `gh-pages` | Machine branch — CI-owned visual-report host; exempt from protection and the local guard |

## Allowed merge directions

- **`feat/*` → `develop`** — normal feature work
- **`develop` → `main`** — release PR (handled by release automation)
- **`fix/*` → `main` → back-merge `main` → `develop`** — the **only** sanctioned route into `main` outside a release PR

Do **not** open feature PRs into `main`.

## Hotfix path

When production (`main`) needs an urgent web fix:

1. Branch `fix/*` from `main`
2. Open a PR **into `main`**
3. After merge, immediately open a back-merge PR **`main` → `develop`** so the branches do not diverge

The back-merge is mandatory, not optional.

## Protection outcomes

After cutover, both `main` and `develop` are protected (applied via `.github/branch-protection.json`):

- Pull requests required before merging (0 approving reviews — solo maintainer can merge)
- Stale review dismissals enabled
- Required status checks: `ci-web-required`, `ci-desktop-required`, `e2e-smoke`, `e2e-visual`
- Branches do **not** need to be up to date before merge (`strict: false`)
- Direct pushes blocked; force pushes and branch deletion blocked
- Linear history required
- `enforce_admins: true` — no owner bypass
- `gh-pages` is **not** protected — CI pushes to it directly

## Audit commands

Read-only verification (re-runnable):

```bash
OWNER=lucasfevi
REPO=bombfarm-companion

gh api repos/$OWNER/$REPO --jq .default_branch
gh api repos/$OWNER/$REPO/branches/develop/protection \
  --jq '{checks: [.required_status_checks.checks[].context], pr: .required_pull_request_reviews.required_approving_review_count, force: .allow_force_pushes.enabled, del: .allow_deletions.enabled, linear: .required_linear_history.enabled, admins: .enforce_admins.enabled}'
gh api repos/$OWNER/$REPO/branches/main/protection --jq '.required_status_checks.checks[].context'
gh api repos/$OWNER/$REPO/branches/gh-pages/protection 2>&1 | head -1
gh run list --branch develop --limit 5 --json workflowName,conclusion,url
gh run list --branch main    --limit 5 --json workflowName,conclusion,url
vercel ls bombfarm-companion
```

## Local guard

A Husky pre-push hook (`.husky/pre-push` → `tools/pre-push-guard.mjs`) refuses direct pushes to `main` and `develop` from a local clone, with a message pointing at the PR flow.

- **Bypass:** `git push --no-verify` (documented escape hatch for legitimate release actions)
- **`gh-pages` is not guarded** — the hook's protected list excludes it; CI pushes from a temp clone without Husky installed

## Migration

If you have local branches or open PRs from before the cutover:

- **Open PRs:** retarget the base branch to `develop` in the GitHub PR UI
- **Local `feat/*` branches based on `main`:** `git rebase --onto origin/develop origin/main feat/x`
- **Stale `origin/HEAD`:** run `git remote set-head origin -a` so your clone's default remote branch tracks `develop`

## Deploy surfaces

| Surface | Branch | URL | Access |
| --- | --- | --- | --- |
| Production | `main` | [bombfarm-companion.vercel.app](https://bombfarm-companion.vercel.app) | Public |
| Pre-production preview | `develop` | [bombfarm-companion-git-develop-lucasfevi-projects.vercel.app](https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app) | Gated by **Vercel Authentication** (owner-only today; not a shareable playtester link) |

No Custom Environment, no custom domain, no new GitHub Actions secret, and no change to the Vercel Git integration is required for the develop preview.

## Related

- [`git-commits.md`](git-commits.md) — atomic commits and PR workflow
- [`AGENTS.md`](../AGENTS.md) — agent guide index
