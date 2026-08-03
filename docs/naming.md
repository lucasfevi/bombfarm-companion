# Naming conventions

**Status:** hard truth — accepted 2026-07-30 (W8, MOD-42)
**Cursor stub:** [`.cursor/rules/naming.mdc`](../.cursor/rules/naming.mdc)

Canonical reference for modular-architecture naming (MOD-23..MOD-27). Written against the lint rules **as landed in W1** (`warn` only). W8 promotes this doc via [`hard-truths.md`](hard-truths.md) after the waves that make each rule real.

## Rules

### MOD-23 — kebab-case filenames

Every file under `src/` uses kebab-case basenames (including `packages/ui/src/*`).

| | |
| --- | --- |
| **Lint rule** | `unicorn/filename-case` with `{ case: 'kebabCase' }` |
| **Severity today** | `error` |
| **Makes real** | **W2** (ui/ kebab renames landed); **W7** flips the rule to `error` |

Inventory: [`.specs/features/modular-architecture/lint-warning-inventory.md`](../.specs/features/modular-architecture/lint-warning-inventory.md).

### MOD-24 — reserved suffixes and name ↔ export

Reserved suffixes: `.recipe.ts`, `.slice.ts`, `.selectors.ts`, `.store.ts`, `.stories.tsx`, `.test.ts`, and `use-*.ts` for hooks. A renamed file's basename matches its primary export in kebab form.

| | |
| --- | --- |
| **Lint rule** | No dedicated ESLint rule in W1 — enforced by W2 rename procedure + review; W7 closes residual mismatches |
| **Severity today** | n/a (convention until W7) |
| **Makes real** | **W2** (files it renames); residual already-kebab mismatches deferred to **W7** |

### MOD-25 — identifier conventions

Components `PascalCase`; hooks `useCamelCase`; store actions verb-first; selectors `select*`; booleans `is`/`has`/`should`/`can`; prop callbacks `onXxx` / `handleXxx`; constants `SCREAMING_SNAKE_CASE`; types `PascalCase` with no `I` prefix.

| | |
| --- | --- |
| **Lint rule** | Partial — `id-length` covers length only; casing conventions are review + later waves |
| **Severity today** | `id-length` at `error` (see MOD-26); no casing lint in W1 |
| **Makes real** | **W7** naming sweep + severity flips where a rule exists |

### MOD-26 — no terse identifiers

Names say what they hold. Two rules enforce this together, because either one alone has a blind spot.

**1. No 1–2 letter identifiers** in non-test `src/`. Loop counters are spelled (`index`, or something descriptive — `i`/`j`/`k` are *not* exempt). Explicit reviewed allowlist only.

**2. No cryptic abbreviations**, even at 3+ characters. Write `formatNumber` not `fmt`, `index` not `idx`, `comparison` not `cmp`, `direction` not `dir`. Prefer deleting a pointless alias over renaming it: `const fmt = formatNumber` should just be `formatNumber` at the call site.

> **Why two rules.** `id-length` uses `min: 3`, so it is structurally blind to 3-letter abbreviations. During W7 this let `fmt` (155 sites) and `idx` survive a burn-down that reported "zero findings" — even though the W7 spec had explicitly named both. `id-denylist` closes that gap. A rule that reports clean is not the same as a codebase that reads well.

| | |
| --- | --- |
| **Lint rules** | `id-length` (`min: 3`, `properties: 'never'`, exceptions `['_', 'cn', 'en', 'pt']`) + `id-denylist` (banned abbreviations). Both are off for tests and stories. |
| **Severity today** | `error` (both) |
| **Makes real** | **W7** renames + flips to `error`; W7 adds `id-denylist` |

**Extending the denylist.** When you spell out an abbreviation, add it to `id-denylist` in `eslint.config.mjs` once its count reaches zero in non-test `src/`. That converts a one-time cleanup into a permanent guarantee.

**Allowlisting instead of renaming** is the exception, not the fallback. Each entry carries a written reason. Current entries are `cn` (classnames helper, ~60 call sites) and `en`/`pt` (i18n `Lang` codes) — both kept for churn, not necessity, and both fair to revisit.

**Object properties are not identifiers.** `properties: 'never'` is deliberate: `rarity.idx` is a field of the JSON catalog data, and renaming it would change a data contract, not a variable name. Do not "fix" those.

**Residue: none.** Every cryptic abbreviation in non-test `src/` has been spelled out, and all 41 are on `id-denylist`. What still matches a naive grep is *not* an identifier and must be left alone:

| Looks like | Actually is | Example |
| --- | --- | --- |
| `calc` | CSS function inside a class string | `w-[min(var(--maxw),calc(100%-32px))]` |
| `img` | JSX intrinsic element | `<img src={iconUrl} …>` |
| `btn` | CSS class name | `coffee: 'btn coffee'` |
| `avg` | glossary token data, prose comments, frozen i18n copy | `bdFormulaActive: "avg × bombs/s …"` |
| `pct` | **i18n interpolation key** — see below | `sub(strings.phasesPenNeedHint, { pct })` |
| `src` | DOM attribute (the *variable* is `iconUrl`) | `src={iconUrl}` |

**The one deliberate exception: `{pct}`.** `src/shared/i18n/namespaces/phases.ts` uses a `{pct}` placeholder that `sub()` resolves by key, so the call site must pass `{ pct: … }`. Renaming it is **not** safe: `sub()` falls back to `vars[key] ?? ''`, so a mismatched key renders an empty string silently — no throw, no failing assertion. It is also locked by `src/tests/fixtures/i18n-strings-main.json`, a fixture captured from `main` that MOD-03 forbids editing. `properties: 'never'` means `id-length` ignores it and `id-denylist` does not reach object-literal keys, so no rule fights this.

> **i18n placeholder keys are a data contract, not a naming choice.** Renaming one means editing frozen display strings in every language. Leave them.

### MOD-27 — case-only renames

Case-only renames use two-step `git mv` through a temporary name so Windows and CI agree. CI asserts no two files differ only by case.

| | |
| --- | --- |
| **Lint rule** | Not ESLint — `tools/check-filename-case.mjs` lands in **W2** |
| **Severity today** | n/a until W2 |
| **Makes real** | **W2** |

## Enforcement status (post-W7)

- Every rule above that has a lint rule is at **`error`**: `unicorn/filename-case`, `id-length`, `id-denylist`, and the `max-lines` budgets (300 hard cap / 200 feature-UI / 150 hooks). W1 landed them at `warn`; **W7** flipped them and burned the findings to zero.
- Allowlists are small and each entry carries a written reason — see [`lint-error-inventory-w7.md`](../.specs/features/modular-architecture/lint-error-inventory-w7.md).
- MOD-25's casing conventions are still **review-enforced**; no lint rule covers them.
- This doc is not listed under hard truths and has no `.cursor/rules/` stub until W8 promotion (MOD-42) is accepted.
