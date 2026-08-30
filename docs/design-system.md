# Design system — cva primitives + reuse boundary

**Status:** reference (durable) · **Feature:** `design-system`

The planner's visual language is encoded as a small set of typed primitives under
[`packages/ui/src/`](../packages/ui/src). Primitives wrap `@base-ui/react` where an
interactive equivalent exists and dress it via [`class-variance-authority`](https://cva.style)
recipes; conflicting utilities are resolved by `cn()` (`clsx` + `tailwind-merge`).

## Tokens

Design tokens are authored once in [`packages/ui/src/styles.css`](../packages/ui/src/styles.css)
(`@theme` + `:root` aliases) with a typed mirror in
[`packages/ui/src/tokens.ts`](../packages/ui/src/tokens.ts). The same file also carries the shared
base element chrome (scrollbars, checkbox skin, base `table` styling, the `.btn.coffee` exception)
so every app that imports it gets both the tokens and the chrome that dresses them. Apps import
`@bombfarm/ui/styles.css` and add their own `@source` scan paths. The planner is **dark-only at runtime**:
no `prefers-color-scheme` toggle. Primitives reference tokens **only** through Tailwind theme utilities
(`bg-surface`, `text-muted`, `border-line`, …) or `color-mix(... var(--token) ...)`
arbitrary values — never hardcoded palette literals (the one documented exception is the Ko-fi
brand button, `AD-003`).

| Group | Tokens |
| --- | --- |
| Surfaces | `bg`, `bg-2`, `surface` |
| Text | `ink`, `muted`, `accent-ink` |
| Lines | `line` |
| Accent / status | `accent`, `up`, `down`, `warn` |
| Rarity | `rar-0` … `rar-5` |
| Type | `font-sans` (`--font`), `font-mono` (`--mono`) |
| Layout | `spacing-top` (`--top`), `max-app` |

Because the token block is self-contained it is the first thing extractable as
`@bombfarm/tokens` for the companion (see the staging table below).

Bare-element `table` / `th` / `td` rules in `packages/ui/src/styles.css`'s `@layer base` are **base
element styling**, not a design-system primitive and not a named CSS exception — see
[`css-exceptions.md`](css-exceptions.md) (TW-07). **All planner tables** use the `DataTable`
compound primitive under `design-system/` (`scrollable` for sticky lists that fill the parent or
optionally `maxRows`/`minRows` rem caps; sticky heads are `z-20` with `border-separate` so row chrome
cannot overlay labels; `Header sortable` for sort chrome). Do not hand-roll `<table>` markup in feature code.

## Primitive inventory

All exported from the barrel [`packages/ui/src/index.ts`](../packages/ui/src/index.ts).

| Primitive | Base UI wrap | Variants / props | Recipe |
| --- | --- | --- | --- |
| `Button` | `@base-ui/react/button` | `variant`: `default` \| `primary` \| `ghost` \| `help` \| `help-on` \| `text` \| `icon` \| `coffee` \| `coffee-full` | `button.recipe.ts` |
| `Chip` | `<span>` | `variant`: `default` \| `on` \| `small` \| `small-active` \| `small-warn` | `chip.recipe.ts` |
| `Stepper` | `@base-ui/react/button` (×2) | `−`/value/`+` trio | `stepper.recipe.ts` |
| `RankControl` | `@base-ui/react/button` | level readout + inc/dec (public props unchanged) | `stepper.recipe.ts` |
| `AbilityCard` | `<div>` | compound `onSheet × selected` + `lockedOut` | `ability-card.recipe.ts` |
| `Banner` | `<aside role="status">` | `tone`: `warn` \| `ok`; `layout`: `page` \| `embedded`; optional `title` | `panel-field.recipe.ts` (`setupBannerRecipe`) |
| `Panel` | `<section>` | `focus` / `aligned` / `unverified` booleans (`need` is a no-op — required uses `FieldRequired`) | `panel-field.recipe.ts` |
| `PanelHeader` | `<div>` + `<h2>` | `title` (required); optional `children` for the row's right-hand side (counters, actions). Section titles only — a hero name keeps bold sentence case | `panel-field.recipe.ts` (`panelHClass`/`panelTitleClass`) |
| `Fields` | `<div>` | `layout`: `inline` \| `inline-dense` \| `stack` | `panel-field.recipe.ts` |
| `Bar` | `<div>` | `pct` + `variant`: `fill` \| `best` | `bar.recipe.ts` |
| `Num` | `@base-ui/react/button` spin + `<input type="number">` | composite numeric field — left chevron steppers, right-aligned value; hide native spinners | `stepper.recipe.ts` (`num*`) |
| `Select` | `@base-ui/react/select` | `size`: `default` \| `compact`; left chevron trigger; **ported popup** (themed options) | `select.recipe.ts` |
| `Switch` | `@base-ui/react/switch` | boolean on/off; Root + Thumb; planner token track/thumb | `switch.recipe.ts` |
| `Accordion` | `@base-ui/react/accordion` | compound `Root`/`Item`/`Header`/`Trigger`/`Panel`; `multiple`; Trigger `tone`: `section` \| `row`, `size`: `default` \| `compact`; `Panel` open/close animates via Motion (`motion/react`), not a CSS transition — see [`animation.md`](animation.md) | `accordion.recipe.ts` |
| `Collapsible` | `@base-ui/react/collapsible` | compound `Root`/`Trigger`/`Panel`; controlled `open` / uncontrolled `defaultOpen`; shared Trigger `tone`/`size`; `Panel` animates via Motion — see [`animation.md`](animation.md) | `accordion.recipe.ts` |
| `Tabs` | Motion (Animate UI animate/tabs) | compound `Root`/`List`/`Tab`/`Panels`/`Panel`; horizontal slide + auto-height; tab `status` tip via Tooltip; `MotionConfig reducedMotion="user"` — see [`animation.md`](animation.md) | inline Tailwind |
| `FieldRequired` | `<span>` | always-mounted “required” badge; `show` toggles `invisible` (no CLS) | `panel-field.recipe.ts` (`reqClass`) |
| `HelpTip` | Base UI `Popover` | always-mounted `?` help; `show` / `active` for status-linked tips | `help-popover.recipe.ts` |
| `Tooltip` | `@base-ui/react/tooltip` + Motion | compound `Provider`/`Root`/`Trigger`/`Portal`/`Positioner`/`Popup`/`Arrow`/`StatusBody`; Animate UI spring scale enter/exit — see [`animation.md`](animation.md) | `tooltip.recipe.ts` |
| `DataTable` | `<table>` compound | `Root` (`scrollable` + optional `maxRows`/`minRows`), `Table`/`Head`/`Body`/`Row`/`Header`/`Cell`/`RowHeader`/`Caption`; sticky heads `z-20` + `border-separate`; `Header sortable` shows stacked ▲▼ when idle, single chevron when active | `data-table.recipe.ts` |
| `GlossaryTerm` | DS `Tooltip` | inline dotted-underline formula token + tip | `glossary-term.recipe.ts` + `tooltip.recipe.ts` |
| `MetricScoreboard` | `<div>` grid | equal-column KPI cells: `cells[]` of `{ id, label, value, tone, delta, deltaTone }`; keeps the invisible `+0.0%` placeholder for delta-less cells (no CLS) — promoted from the planner's `CompareMetricsStrip` (W6); grid is a fixed `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — a caller with fewer than 4 cells passes `className="sm:grid-cols-N lg:grid-cols-N"` (`cn()`/tailwind-merge overrides both breakpoints) rather than leaving a blank trailing cell, e.g. `WaterfallPanel`'s 3-step scoreboard | `metric-scoreboard.recipe.ts` |
| `GlossedText` | `<span>` | renders `template` with `terms: ReadonlyMap<token, tip>` tokens wrapped in `GlossaryTerm`; longest-token-first split; empty `terms` renders a plain wrapper — promoted from the planner's `GlossedFormula` (W6); the i18n glossary itself stays in `features/planner/model/formula-glossary.ts` | inline Tailwind |
| `FileDropZone` | `<div role="button">` | click / keyboard / drag-drop file target; idle vs drag-over chrome via recipe; keeps Enter/Space and `input.value = ''` reset — promoted from import dialog (W6) | `file-drop-zone.recipe.ts` |
| `AppNav` | `<nav>` + `<button>` | segmented nav pill: `items` (`{id, label, active}`), `ariaLabel` (default `'Main'`), `onSelect`; optional `renderItem` render prop lets a caller substitute its own element (the web supplies a Next `<Link>`) for the default `<button type="button">`; renders no `<nav>` at all when `items` is empty — extracted verbatim from the web's former `site-header.tsx` nav + `site-nav-link.tsx` (T4a) | `app-nav.recipe.ts` |
| `SegmentedToggle` | `<div role="group">` + `<button>` | generic bordered flush button group: `options` (`{id, label}`), `value`, `onChange`, `ariaLabel`; no language semantics (DS-09) — extracted verbatim from the web's former inline PT/EN control (T4a) | `segmented-toggle.recipe.ts` |
| `AppShell` | `<header>`/`<main>`/`<footer>` | desktop-only top-bar shell (used solely by `apps/desktop/renderer/app/page.tsx`): sticky header (brand `title`/`badge` lockup, an `AppNav` pill built from `items`/`activeId`/`onNavigate`, and a right-hand `actions` slot), a single scrolling `<main>`, and a slim status strip (`status`/`progress`/`version`). Same top-bar shape as the web's `SiteHeader`, replacing the desktop's earlier icon-rail sidebar (T4a). `draggable`/`overlayInset` are implemented for a later custom-title-bar task and default off | `AppShell.recipe.ts` |

### Game art (`packages/game-art/src/`)

Wiki-sourced game assets (heroes, items, abilities, …), shared by the web planner and the desktop
Inventory surfaces. It is its own workspace package rather than part of `packages/ui` because it
depends on `@bombfarm/domain` (hero/gear shapes, `wiki-assets.ts` URL builders) and `@bombfarm/ui`,
which DS-09 forbids `packages/ui` itself from doing. **Do not overlay crystal gems** on item art.
Hero avatars stay square with a **neutral fill + rarity border**. Gear frames are **portrait
`18/19`** (in-game inventory pitch) with a **radial rarity plate** (`--rar-slot-N-glow/mid/edge`,
legendary adds faint vertical rays) plus the matching rarity border. Export from
[`packages/game-art/src/index.ts`](../packages/game-art/src/index.ts); the web keeps a thin
re-export barrel at [`apps/web/src/shared/game-art/index.ts`](../apps/web/src/shared/game-art/index.ts)
so its existing `@/shared/game-art` call sites are unchanged. Bundled sprites live in
`packages/game-art/assets/`; each app copies them into its own `public/wiki-assets/` at build time
(`apps/*/scripts/copy-wiki-assets.mjs`, wired as a `prebuild` step) since Next only serves files
under an app's own public root.

| Component | Role | Recipe |
| --- | --- | --- |
| `ArtFrame` | Rarity-tinted frame (`rounded-sm`); `shape` square/portrait; `fill` neutral/rarity | `game-art.recipe.ts` → `artFrameRecipe` |
| `HeroAvatar` | Save `skin` portrait inside square `ArtFrame` (display map swaps wiki `hero2`/`hero3` vs save skins 1/2) | composes `ArtFrame` |
| `ItemIcon` | Catalog item PNG in portrait frame + halo level / `+N` | composes `ArtFrame` + `iconMetaGlyphRecipe` |
| `AbilityIcon` | Wiki ability PNG in neutral square frame + halo `n/20` | `game-art.recipe.ts` → `abilityIconRecipe` + `iconMetaGlyphRecipe` |
| `HeroAbilityIcons` | Roster row of pool abilities + name/`n/20` tooltip | composes `AbilityIcon` + DS `Tooltip` |
| `HeroGearIcons` | Roster row of all 8 slots (item or empty) + slot/item tooltip | composes `ItemIcon` + DS `Tooltip` |

**Roster picker interaction:** each hero row is **one keyboard tab stop** (`<tr tabIndex={0}>` + `aria-label`, no `role="button"`). Gear/ability icon tooltips use DS `Tooltip.Trigger` as `type="button"` with `tabIndex={-1}` — hover/pointer supplementary detail without nested tab traps. Row `Enter`/`Space` still selects the hero; icon clicks `stopPropagation` so tooltips never fire row pick.

**Tooltip trigger nested inside another interactive control:** `Tooltip.Trigger` renders a `<button>` by default, which is invalid HTML nested inside another `<button>` (e.g. an `Accordion.Trigger` row). Swap the rendered tag via `render={<span />}` instead of `type="button"` — see `AbbreviatedNumber` (`apps/web/src/features/team-plan/components/abbreviated-number.tsx`), which shows a `formatCompactNumber` value's exact figure on hover/focus from inside a Team plan Accordion row. Pair with `tabIndex={-1}` (via a `disableFocus` prop) when the trigger sits inside an already-focusable ancestor, matching the icon-tooltip convention above.

**Roster columns:** avatar (unsorted) · rank · name+★ · rarity · lv · power · gear · abilities · status. Table avatars use `lg` (same width token as gear/ability). Switch-hero / import name uses `text-base leading-none font-bold` (same as the planner hero strip); rarity uses `text-sm leading-none font-bold`. Disabled (`battleAllowed === false`) rows use `rosterInactiveChromeClass` (`opacity-55 grayscale`) on scan chrome; the status toggle stays full chroma.

**Sizes** (`artFrameRecipe` width tokens / `abilityIconRecipe` squares): `xs` (28px) compact · `sm` (32px) · `md` (44px) · `lg` (48px wide) roster / import / phases / hero strip · `xl` (64px wide) Gear tab + Ability tab. Gear `shape: portrait` is `aspect-[18/19]` (e.g. `lg` → 48×51). Abilities stay square at the same width token.

**Inventory meta glyphs** (`iconMetaGlyphRecipe`): no plaque fill — halo `text-shadow` only. Gear: level `top-end`, forge `+N` `bottom-end` in `text-rar-4` (hide `+0`). Abilities: `n/20` `bottom-center`. `compact` (10px) on `xs`/`sm`; `roomy` (11px) on `md`+.

**Gear slot chrome** ([`slot-editor.tsx`](../apps/web/src/features/gear/components/slot-editor.tsx)): outer slot card stays **neutral** (`border-line`); equipped rarity reads from the item frame only. Filled slots hide the slot-name label, center the `xl` icon, and pin clear at `absolute -top-1 -right-1`. Empty slots show the slot name inside a dashed placeholder sharing `artFrameRadiusClass`. Gear compare clones reuse `GearSlotStatsGrid` under the alt-loadout editors.

Asset path helpers: [`packages/domain/src/wiki-assets.ts`](../packages/domain/src/wiki-assets.ts) (domain helper, not under `design-system/`). Save `skin` is the in-game index; `heroAvatarSrc` remaps display paths (`[1,3,2,4,5,6,7,8]`) so wiki filenames stay canonical.

### Form controls (`Num` / `Select`)

Both are **composite shells** (not bare browser widgets):

| Piece | `Num` | `Select` |
| --- | --- | --- |
| Outer / trigger | `[data-num]` bordered `bg-bg` shell | `[data-select]` bordered `bg-bg` trigger |
| Left affix | Interactive ▲/▼ on `bg-bg-2` (accent hover) | Chevron on `bg-bg-2` |
| Control / value | Borderless `type="number"`, `text-right`, tabular nums | `Select.Value` label for the chosen item |
| Popup | — | Portaled list on `bg-surface` / `text-ink` (native `<option>` menus are **not** used — OS chrome cannot match dark tokens) |
| Fields wiring | Stack/inline size the shell via `[data-num]` | Stack/inline size the trigger via `[data-select]` |

Call sites may keep `<option>` children; the primitive converts them to Base UI items and still emits a synthetic `onChange` with `target.value` as a string.

Do **not** restyle native `::-webkit-inner-spin-button` or OS `<select>` menus in `globals.css` — compose these primitives instead. Prefer `Select` / `Num` over raw `<select>` / `<input type="number">` in feature UI. Prefer `Switch` over inventing Button/checkbox toggles for boolean flags.

**Never use the native `title` attribute as a tooltip — use the `Tooltip` compound primitive.** The
native one is not a weaker version of ours, it is a different thing: OS chrome that cannot be
styled and ignores every planner token, on a delay the browser owns and the app cannot change,
which never appears on touch and is not shown on keyboard focus. Whatever it carries is therefore
invisible to a touch or keyboard user, which is why it is banned outright rather than discouraged.

The ban is lint-enforced by `react/forbid-dom-props` in both `eslint.config.mjs` (covering
`packages/ui`, `packages/game-art`, `apps/desktop/renderer`) and `apps/web/eslint.config.mjs`
(covering `apps/web/src`). It targets **DOM elements only**, so `title` stays a legal prop on
`PanelHeader`, `EmptyState`, `Banner` and `SettingsSection`. Its blind spot is a primitive that
spreads unknown props onto its own DOM element — `title` passed to one of those is still a native
tooltip and still forbidden, with only review to catch it. A genuine non-tooltip use of the
attribute (`<abbr title>`) is an `eslint-disable-next-line` on that one line saying why — never a
widened rule. `apps/web/eslint.config.mjs` also carries a burn-down list of the six planner files
that predate the ban; delete an entry as its file migrates.

When the trigger sits inside another interactive element — a link, an `Accordion.Trigger` row —
swap the rendered tag with `render={<span />}` (or `render={<a … />}` to make the link itself the
trigger), because `Tooltip.Trigger` renders a `<button>` by default and nesting one inside another
interactive element is invalid HTML. See the *Tooltip trigger nested inside another interactive
control* note above.

**Before adding a new interactive primitive or inventing a toggle/control pattern:** follow [`base-ui-first.md`](base-ui-first.md) — check Base UI, wrap with cva + tokens, prefer `Switch` for boolean flags. Prefer `Accordion` / `Collapsible` over inventing `<details>`/`<summary>` disclosures.

**Layout / label fit:** follow [`content-fit-ui.md`](content-fit-ui.md) — size from longest real EN/PT content; no accidental truncation; align sibling stack controls.

**Conditional chrome:** follow [`no-layout-shift.md`](no-layout-shift.md) — do not mount/unmount required badges; use `FieldRequired`.

Fixed layout bundles (no real variants) live as **documented recipe constants** (DS-05) inside
each `*.recipe.ts` module — e.g. `colClass`, `panelHClass`, `statListClass`, the `abil*` layout
classes. These are imported directly from the recipe module (not re-exported from the barrel),
because they dress plain elements rather than back a primitive. Direct `*.recipe.ts` imports are
the sanctioned MOD-12 carve-out; every other design-system module is barrel-only.

## Compound namespace file layout (W6)

`Dialog`, `Collapsible`, `Accordion`, `Tabs`, `Tooltip`, and `DataTable` are each a **directory**
under `packages/ui/src/`, not a single module — e.g. `dialog/`, not `dialog.tsx`:

- **One `.tsx` (or `.ts` for non-component internals) per part.** Every file exports exactly one
  component; the file's kebab-case name matches its export (`dialog-root.tsx` → `DialogRoot`,
  `tooltip-popup.tsx` → `TooltipPopup`), per MOD-24.
- **`index.ts` is the namespace assembly point**, never a component itself. It imports every part,
  re-exports the namespace object (`export const Dialog = { Root: DialogRoot, … }`) with the same
  key order the compound has always had, and re-exports the full prop-type set the barrel needs.
  A namespace `index.ts` is compliant-by-construction with the one-component-per-file rule (MOD-28)
  because it exports an object, not a component.
- **Shared internals get their own non-component module** instead of living inside a part file:
  `*-context.ts` (React context + its `use*Ctx()` hook), `*-transitions.ts` (Motion `Transition`
  literals), `types.ts` (prop types), and one-off helpers like `data-table/head-align.ts`. No part
  file imports another part file directly — only via `types.ts`, a `*-context.ts` module, or the
  namespace `index.ts` itself (e.g. `tabs-tab.tsx` imports `../tooltip`, the `Tooltip` namespace
  index, never a `tooltip/tooltip-*.tsx` part).
- **Recipes stay flat at the design-system root.** `accordion.recipe.ts`, `data-table.recipe.ts`,
  `tooltip.recipe.ts`, `dialog.recipe.ts` are **not** moved into their namespace folder — they back
  more than one family (`accordion.recipe.ts` also dresses `Collapsible`; `data-table.recipe.ts`
  also backs the deprecated `SortableTableHeader` shim), and moving them would turn a shared
  constant into a cross-folder import.
- **The barrel (`packages/ui/src/index.ts`) keeps writing `from './dialog'`, `from
  './tabs'`, etc.** — Node/TypeScript resolve a bare specifier to `<name>/index.ts` automatically,
  so replacing the file with a same-named directory is a zero-diff change from the barrel's point
  of view, as long as the old file is deleted in the same commit (a stale `<name>.tsx` sitting next
  to `<name>/` would silently win resolution and make the split dead code).
- **Standalone back-compat exports that happen to live beside a namespace** (`TableScroller`,
  `SortableTableHeader`, `stickyHeadClass` in `data-table/`) are not namespace parts — they're their
  own file each, calling the real part they forward to, and the namespace `index.ts` re-exports them
  alongside the compound object so the barrel line is unaffected.

This convention is **AD-021** and applies to every future compound primitive.

## cva conventions

- **One recipe per primitive family**, kept in a `*.recipe.ts` next to the primitive. Variant
  tables never get scattered across leaf feature components.
- Where variants have **differing bases** (e.g. `btn` vs `text` vs `icon` buttons) each variant
  emits its **full class string** with an empty cva `base`, so historic per-variant class order
  is preserved byte-for-byte.
- Use cva `compoundVariants` for genuine multi-axis state (`AbilityCard`'s `onSheet × selected`)
  instead of hand-written `if/else` resolvers.
- Always set `defaultVariants` so the bare primitive renders the former default chrome.
- Export the variant union type (`type ButtonVariant = …`) for call sites that dress a
  non-primitive element (e.g. a Ko-fi `<a>`, a `Dialog.Close`) via `recipe({ variant })`.

## `cn()` usage

[`packages/ui/src/cn.ts`](../packages/ui/src/cn.ts) = `twMerge(clsx(inputs))` (also re-exported from the design-system barrel).

```ts
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- `clsx` gives conditional/array/falsy class composition.
- `tailwind-merge` resolves **conflicting** utilities last-wins at merge time
  (`cn('bg-bg-2', 'bg-accent') === 'bg-accent'`), which is what neutralises the old
  "stylesheet order wins" foot-gun (former `tailwind-first.md` rule 10).
- Every primitive merges its recipe output with the caller `className` **last** so overrides win:
  `cn(buttonRecipe({ variant }), className)`.

## Reuse boundary (DS-09)

`packages/ui/src` is a **self-contained module** with a single public entry,
[`packages/ui/src/index.ts`](../packages/ui/src/index.ts). The boundary exists so the
system can later be extracted for the Bomb Farm companion (same Tailwind 4 + `@base-ui/react`
stack) with minimal churn.

**Invariant — edges point outward only.** Nothing under `design-system/` (the barrel or any of its
transitive imports) may import from planner feature code:

- feature folders: `features/planner`, `features/roster`, `features/gear`, `features/account`, …
- planner domain/model: `@bombfarm/domain`, `apps/web/src/shared/lib/storage`, … (game logic)

Features import **from** `design-system/`; `design-system/` never imports back. Keep Electron / IPC / game-server
concerns out of primitives entirely. Imports of `shared/lib/**` (e.g. `cn`) remain legal.

### How to verify the boundary

The boundary is **lint-enforced, not grep-checked** — `eslint-plugin-boundaries`'
`boundaries/element-types` rule (`eslint.config.mjs`, `error`) declares
`@bombfarm/ui` sources as a boundary and allows them to depend on only themselves and
shared lib helpers; every other edge (into a feature, into `@bombfarm/domain`, `@bombfarm/game-art`,
`shared/context`, `shared/i18n`) is `disallow` by default. Package-aware element mapping is
tracked debt for `mp1-ci-vercel-rebrand` / hygiene — until then, treat the reuse boundary as
convention + review, not a fully wired package path. Run `pnpm lint` — a violation of still-mapped
web `src/` elements fails the build.

**To see it fail:** add an import from a feature into any `design-system/` file and run
`pnpm lint`. It reports, verbatim:

```
error  There is no policy allowing dependencies from elements of type "shared-design-system"
to elements of type "feature" and captured values: feature="planner"  boundaries/element-types
```

`design-system/` may depend only on React, `@base-ui/react`, `cva`/`clsx`/`tailwind-merge`,
`react-icons` **via `src/icon/` only** (lint-enforced — see [Icons](#icons)), `@theme` tokens (via utility class names), `shared/lib/**`, plus pure
presentational helpers it fully owns.

## Icons

All icon rendering goes through the `Icon` primitive exported from `@bombfarm/ui`. Call sites pass a
closed `IconName` string — never a vendor component or a raw `.svg` import.

### Source

| Source | Module | Contents |
| --- | --- | --- |
| UI chrome | `packages/ui/src/icon/ui-registry.ts` | The **only** file in `packages/ui` allowed to import `react-icons` (chevrons, close mark, coffee story icon) |

`registry.ts` exposes that map as the public `IconName` union. Companion v1 does **not** ship original game-glyph SVGs (slots, rarity ornaments, gem/key/gold) — inventory chrome can use text/badges or wiki art decisions later; do not reintroduce a second icon source without an explicit product decision.

### Size scale

| `size` prop | Tailwind utility | Pixels | Default |
| --- | --- | --- | --- |
| `xs` | `size-3` | 12px | |
| `sm` | `size-4` | 16px | yes |
| `md` | `size-5` | 20px | |
| `lg` | `size-6` | 24px | |

Off-scale boxes (8px idle sort chevrons, 14px select/num affixes) use the **`className` escape
hatch** merged last via `cn()` — do not add ad-hoc steps to the public `IconSize` enum.

### Accessibility

Semantics live on a wrapping `<span>`; the inner `react-icons` SVG is always decorative
(`aria-hidden`), because those components force `aria-hidden` on the SVG after prop spread.

- **Decorative by default:** omit `label` (or pass `""`) → wrapper `aria-hidden="true"`.
- **Meaningful icons:** pass `label="…"` (already-translated) → wrapper `role="img"` + `aria-label`.

### Lint seam

- `packages/ui/**` and `apps/desktop/**`: raw `react-icons` or `*.svg` imports fail lint outside `packages/ui/src/icon/**`.
- `apps/web/**`: eight planner files are **grandfathered** in `apps/web/eslint.config.mjs` (`site-header`, `footer`, `slot-editor`, `import-heroes-dialog`, `hero-picker-dialog`, `hero-strip`, `hero-strip-identity`, `phases-hero-switcher`). Delete an entry when that file migrates to `<Icon />`; any **new** web call site errors immediately. (`topbar.tsx` — dead code, unreachable from any route — was deleted in T4a rather than migrated.)
- `packages/ui/**/*.stories.tsx`: **covered too.** Stories are excluded from `packages/ui/tsconfig.json`, so root ESLint lints them with type checking off (`disableTypeChecked`) — the raw-icon ban applies. `tailwindcss/no-unnecessary-arbitrary-value` is deliberately off there: stories size demo frames to taste.
- **Known gap:** `packages/ui/**/*.{test,spec}.{ts,tsx}` are still ignored by root ESLint (same tsconfig reason), so a raw icon import in a unit test is caught by review only. Narrow blast radius, no owning feature yet.

Storybook gallery: [`packages/ui/src/icon.stories.tsx`](../packages/ui/src/icon.stories.tsx) (enum-driven UI chrome).

## Companion reuse strategy (decided)

No companion-repo changes happen in this wave — this is boundary preparation only.

| Question | Decision (this wave) | Later |
| --- | --- | --- |
| Token-only vs full component library | **Token-only extraction first** — the `@theme` block in `globals.css` is the token source-of-truth, isolatable as `@bombfarm/tokens`. | Promote stable primitives (`Button` / `Chip` / `Panel` / `Num` / `Select`) to `@bombfarm/ui` once APIs settle. |
| In-repo vs published package | **In-repo extractable boundary now** (barrel export, no app coupling). | Publish or workspace-link. |
| Monorepo workspace vs separate repo | **Recommend an eventual shared pnpm workspace** (`packages/tokens`, `packages/ui`) over a separate repo, to avoid version-sync friction. | Confirm with companion owners when it consumes the system. |
| Stack alignment | Build on the Tailwind 4 + `@base-ui/react` intersection so primitives port directly; keep Electron / IPC / game-memory concerns out. | — |

Staging order: **tokens → stable primitives → shared workspace package**, promoting only
once the primitive API surface stops churning.

## Storybook catalog

Local catalog for `packages/ui/src` primitives, **owned by `packages/ui` itself** on
`@storybook/react-vite` (dark-only preview, desktop/tablet viewports). Moved off
`apps/web`'s `@storybook/nextjs` host in `m2-storybook-ci` — the catalog belongs with
the package it documents, not with an app that merely consumes it.

| Command | Purpose |
| --- | --- |
| `pnpm --filter @bombfarm/ui storybook` | Dev server on `:6006` |
| `pnpm --filter @bombfarm/ui build-storybook` | Static build → `packages/ui/storybook-static/` (gitignored) |
| `pnpm --filter @bombfarm/ui test-storybook` | Serves the static build, then runs `@storybook/test-runner` — smoke-renders every story and asserts zero `@storybook/addon-a11y` violations |

Authoring rules (colocate stories under `packages/ui/src`, barrel imports only, no
light/phone matrix, a11y expectations): [`packages/ui/.storybook/README.md`](../packages/ui/.storybook/README.md).

Preview loads Tailwind via [`packages/ui/.storybook/preview.css`](../packages/ui/.storybook/preview.css),
which imports `packages/ui/src/styles.css` directly (self-sufficient — its own
`@import 'tailwindcss'` + `@source` scan of `packages/ui/src`, processed by the
`@tailwindcss/vite` plugin wired in `main.ts`). Canvas uses app tokens (`bg-bg` /
`text-ink` / `font-sans`); fonts are self-hosted via `@fontsource` (DM Sans, IBM Plex
Mono) rather than `next/font` — no Next.js under Vite, and no CDN. If stories look like
unstyled browser defaults, rebuild and confirm the Vite Tailwind plugin is processing
`preview.css`. See also [`tailwind-first.md`](tailwind-first.md) rule 11.

### CI gate

`.github/workflows/ci-web.yml`'s `design-system` job runs `build-storybook` then
`test-storybook` on the existing `web` path filter (`packages/ui/**` is already in it).
The `design-system-required` aggregator fails whenever that filter matched but the job
didn't succeed — including `skipped` and `cancelled`, not only an active failure — so a
suite that silently never ran cannot pass as green (see
[`tools/design-system-gate.test.mjs`](../tools/design-system-gate.test.mjs), which
asserts the aggregator has no step that treats `skipped` as success).
