# Branching — `develop` integration, `main` release-only

**Status:** hard truth (agent workflow)

This repo uses a two-branch integration model. Feature work lands on **`develop`**; **`main`** is release-only.

## Branch roles

| Branch | Role |
| --- | --- |
| `develop` | Default integration branch — feature PRs target here |
| `main` | Release-only — reachable via a release PR from `develop` or the hotfix path below |
| `<type>/*` | Short-lived work branches — see [Branch names](#branch-names) |
| `release/next` | Machine branch — changesets release PR; exempt from the naming rule |

## Branch names

Work branches are named **`<type>/<kebab-case-summary>`**, using the same types commitlint accepts
for commit subjects. The branch then reads like the commit that will land it.

| Part | Rule |
| --- | --- |
| `<type>` | One of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test` — the `@commitlint/config-conventional` set, no others |
| separator | A single `/`, exactly one segment on each side |
| `<summary>` | Lowercase kebab-case, two to five words, describing the change — not a ticket id alone, and no trailing random suffix |

```
^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)/[a-z0-9]+(-[a-z0-9]+)*$
```

Good: `feat/rotation-pool-redesign`, `fix/stale-vip-window`, `docs/comments-hard-truth`.
Bad: `comments`, `lucas/wip`, `feat/issue-243`, `claude/code-comment-policy-924368`.

Exempt: `main`, `develop`, `release/next`, and `backup/*` snapshots.

This is enforced — the [local guard](#local-guard) refuses a push from a branch that does not match.

### Rename a generated branch before the first push

Tooling that opens a branch for you — an agent harness, an issue-to-branch helper — hands you a
generated name with a random suffix. That name is not conventional and tells a reader nothing, so
**rename it as soon as you know what the change is**, before anything is pushed:

```bash
git branch -m docs/comments-hard-truth
```

If it was already pushed, push the new name and delete the old one — but only while no PR is open
against it; retarget or reopen the PR rather than force-moving a branch someone is reviewing.

```bash
git push origin -u docs/comments-hard-truth && git push origin --delete claude/old-generated-name
```

## Allowed merge directions

- **`<type>/*` → `develop`** — normal feature work
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
- Required status checks (both branches): `ci-web-required`, `ci-desktop-required`, `repo-guards-required`, `e2e-smoke`, `fidelity-gate-required`, `line-endings-required`, `design-system-required`
- `develop` additionally requires: `Require a changeset` — the changesets check; the release PR into `main` is exempt by design, and a PR labelled `skip-changeset` skips the job, which GitHub counts as passing
- Branches do **not** need to be up to date before merge (`strict: false`)
- Direct pushes blocked; force pushes and branch deletion blocked
- `enforce_admins: true` — no owner bypass

Where they differ:

| Branch | `required_linear_history` | Why |
| --- | --- | --- |
| `develop` | `true` | Feature PRs are squashed; a flat integration log is what we want |
| `main` | `false` | The release PR is merged with a merge commit so `main` inherits `develop`'s real history — see [Merge strategy](releases.md#merge-strategy) |

Relaxing it on `main` is deliberate and load-bearing: with linear history required, the
release PR can only be squashed, and a squash leaves `main` sharing no ancestry with the
branch it came from. That is what made every release PR list every commit since PR #10.

### Applying the JSON

A verbatim `PUT` replaces the whole required set, so diff live against the file first — the
JSON is the intended state, and [`tools/branch-protection-parity.test.mjs`](../tools/branch-protection-parity.test.mjs)
keeps it, the workflows and this page in agreement, but it cannot see what GitHub holds.

```bash
gh api repos/lucasfevi/bombfarm-companion/branches/develop/protection/required_status_checks --jq '.contexts | sort'
jq '[.required_status_checks.checks[].context] | sort' .github/branch-protection-develop.json
```

When the JSON contains every live context you intend to keep, apply it verbatim:

```bash
gh api -X PUT repos/lucasfevi/bombfarm-companion/branches/develop/protection --input .github/branch-protection-develop.json
gh api -X PUT repos/lucasfevi/bombfarm-companion/branches/main/protection --input .github/branch-protection-main.json
```

When it does not, add the missing contexts instead — this form appends and removes nothing,
one `-f` per context:

```bash
gh api -X POST repos/lucasfevi/bombfarm-companion/branches/develop/protection/required_status_checks/contexts -f 'contexts[]=line-endings-required' -f 'contexts[]=design-system-required'
```

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
# main must allow "merge" and nothing else
gh api repos/$OWNER/$REPO/rules/branches/main \
  --jq '.[] | select(.type == "pull_request") | .parameters.allowed_merge_methods'
gh run list --branch develop --limit 5 --json workflowName,conclusion,url
gh run list --branch main    --limit 5 --json workflowName,conclusion,url
vercel ls bombfarm-companion
```

## Local guard

A Husky pre-push hook (`.husky/pre-push` → `tools/pre-push-guard.mjs`) refuses two things from a local clone:

1. **Direct pushes to `main` and `develop`**, with a message pointing at the PR flow.
2. **Branch names that do not match [the pattern above](#branch-names)**, with the `git branch -m` command to fix it.

- **Bypass:** `git push --no-verify` (documented escape hatch for legitimate release actions)
- **Deleting a badly-named branch is always allowed** — a delete-push carries an all-zero local sha, and refusing it would trap you halfway through the rename it is asking for
- **`release/next` and `backup/*` are exempt from the naming rule**, since neither is hand-authored work

## Migration

If you have local branches or open PRs from before the cutover:

- **Open PRs:** retarget the base branch to `develop` in the GitHub PR UI
- **Local `feat/*` branches based on `main`:** `git rebase --onto origin/develop origin/main feat/x`
- **Stale `origin/HEAD`:** run `git remote set-head origin -a` so your clone's default remote branch tracks `develop`

## Deploy surfaces

| Surface | Branch | URL | Access |
| --- | --- | --- | --- |
| Production | `main` | [bombfarm-companion.app](https://bombfarm-companion.app) | Public |
| Pre-production preview | `develop` | [bombfarm-companion-git-develop-lucasfevi-projects.vercel.app](https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app) | Gated by **Vercel Authentication** (owner-only today; not a shareable playtester link) |

No Custom Environment, no custom domain, no new GitHub Actions secret, and no change to the Vercel Git integration is required for the develop preview.

## Related

- [`git-commits.md`](git-commits.md) — atomic commits and PR workflow
- [`AGENTS.md`](../AGENTS.md) — agent guide index
