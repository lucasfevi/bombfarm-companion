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

Both `main` and `develop` are protected. The two configs differ in one field, so each has
its own file: [`.github/branch-protection-develop.json`](../.github/branch-protection-develop.json)
and [`.github/branch-protection-main.json`](../.github/branch-protection-main.json).

Shared by both branches:

- Pull requests required before merging (0 approving reviews — solo maintainer can merge)
- Stale review dismissals enabled
- Required status checks: `ci-web-required`, `ci-desktop-required`, `e2e-smoke`, `e2e-visual`
- Branches do **not** need to be up to date before merge (`strict: false`)
- Direct pushes blocked; force pushes and branch deletion blocked
- `enforce_admins: true` — no owner bypass
- `gh-pages` is **not** protected — CI pushes to it directly

Where they differ:

| Branch | `required_linear_history` | Why |
| --- | --- | --- |
| `develop` | `true` | Feature PRs are squashed; a flat integration log is what we want |
| `main` | `false` | The release PR is merged with a merge commit so `main` inherits `develop`'s real history — see [Merge strategy](releases.md#merge-strategy) |

Relaxing it on `main` is deliberate and load-bearing: with linear history required, the
release PR can only be squashed, and a squash leaves `main` sharing no ancestry with the
branch it came from. That is what made every release PR list every commit since PR #10.

## Merge-method enforcement lives in a ruleset

Protection is **two** config surfaces, not one. Classic branch protection cannot restrict
which merge button a PR may use, so that rule lives in a repository **ruleset**:
[`.github/ruleset-main.json`](../.github/ruleset-main.json) targets `refs/heads/main` and
sets `allowed_merge_methods: ["merge"]`. Squash and rebase are greyed out on any PR into
`main`, and `gh pr merge --squash` fails outright.

- Rulesets and classic protection **coexist** — both are evaluated and the most restrictive
  wins. There is no migration to do; the `branch-protection-*.json` files stay authoritative
  for everything else.
- `bypass_actors` is deliberately **empty**, the ruleset equivalent of `enforce_admins: true`.
- `develop` is untouched, so feature PRs are still squashed. Repo-wide
  `allow_squash_merge: false` would have broken that and is the wrong lever.

Apply or update it with:

```bash
gh api -X POST repos/lucasfevi/bombfarm-companion/rulesets --input .github/ruleset-main.json
# already created? list ids, then PUT .../rulesets/<id> with the same file
gh api repos/lucasfevi/bombfarm-companion/rulesets --jq '.[] | "\(.id) \(.name)"'
```

## Audit commands

Read-only verification (re-runnable):

```bash
OWNER=lucasfevi
REPO=bombfarm-companion

gh api repos/$OWNER/$REPO --jq .default_branch
gh api repos/$OWNER/$REPO/branches/develop/protection \
  --jq '{checks: [.required_status_checks.checks[].context], pr: .required_pull_request_reviews.required_approving_review_count, force: .allow_force_pushes.enabled, del: .allow_deletions.enabled, linear: .required_linear_history.enabled, admins: .enforce_admins.enabled}'
# main must report linear:false — see Merge strategy in releases.md
gh api repos/$OWNER/$REPO/branches/main/protection \
  --jq '{checks: [.required_status_checks.checks[].context], linear: .required_linear_history.enabled, admins: .enforce_admins.enabled}'
gh api repos/$OWNER/$REPO/branches/gh-pages/protection 2>&1 | head -1
# main must allow "merge" and nothing else
gh api repos/$OWNER/$REPO/rules/branches/main \
  --jq '.[] | select(.type == "pull_request") | .parameters.allowed_merge_methods'
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
