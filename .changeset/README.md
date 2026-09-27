# Changesets

This monorepo uses [changesets](https://github.com/changesets/changesets) for version bumps and changelogs.

When your pull request includes user-visible changes, run `pnpm changeset` and commit the generated file under `.changeset/`.

## Hand-writing one: the package name takes double quotes

`tools/release/changeset-validation.mjs` reads each frontmatter line with `/^"([^"]+)":\s*(.*)$/`, so
the only accepted form is

```
---
"@bombfarm/pricing": minor
---
```

Single quotes are valid YAML and the changesets CLI itself does not mind them, but that validator
does — and it runs only in CI, as `Validate changeset files`. A hand-written changeset quoted the
other way therefore passes every local check and fails the pull request. `pnpm changeset` emits the
accepted form; this note is for when you write the file yourself.
