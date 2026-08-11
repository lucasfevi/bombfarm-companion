# Bomb Farm Companion — agent notes

## Changesets are mandatory on every user-visible PR

This monorepo uses [changesets](https://github.com/changesets/changesets). The `Require a changeset`
CI check fails any PR into `develop` that touches versionable code (`apps/web`, `packages/domain`,
etc.) without a `.changeset/*.md` file — it is not optional and not a warning.

**Before opening or updating a PR that changes `@bombfarm/web` or `@bombfarm/domain` behavior**, add a
changeset in the same commit as the code change (or immediately after, before pushing/opening the PR):

```bash
pnpm changeset
```

Or write the file by hand under `.changeset/<kebab-case-slug>.md`:

```markdown
---
"@bombfarm/web": patch
---

One or two sentences: what changed and why, from the user's perspective.
```

- Bump type: `patch` for fixes/tweaks, `minor` for new user-facing features, rarely `major`.
- List every affected package (`@bombfarm/web`, `@bombfarm/domain`) with its own bump line.
- Internal-only changes with zero user-visible effect (CI config, tests, docs, `.claude/`) don't need
  one — but a UI or domain-behavior fix, however small, does.
- If a changeset genuinely doesn't apply, label the PR `skip-changeset` instead of skipping silently.

This has already caused two failed/patched-up PRs (a 3-commit perf branch shipped without changesets
and needed a follow-up `docs(changeset)` commit; PR #39 failed CI the same way and needed one pushed
after the fact). Do the changeset up front, not as a fix-up.
