---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Shows each prop's in-game art next to its name in the two phase prop tables — the phase
**Prop mix** table and the **Your hero** hits-to-kill table.

Both tables named their target prop in text alone, which reads nothing like the game: players
recognise a bush or a mithril node by its sprite long before they read its label, and the two
crystal props in particular are told apart by colour in-game and only by wording in the planner.
The art was already bundled under `public/wiki-assets/env/` for other surfaces, so this is a
display change with no new assets and no math touched.

- **`propIconSrc(propName)` in `@bombfarm/domain`'s `wiki-assets`** — every prop's `name` in
  `PROPS` is also its art filename, so the helper is the same bare join as `abilityIconSrc`, and
  returns `null` on an absent name rather than a `/env/.png` path to nothing.
- **A `PropIcon` component** in the web planner's `game-art` set, rendered at `size-4` inside the
  existing name cell — no column was added and the HP and HITS columns are untouched. The icon is
  decorative (`alt=""`, `aria-hidden`): the prop's label sits beside it in the same cell and
  remains the accessible text, so screen readers hear the name once, not twice. No new
  user-facing string, hence no i18n change.
- **The icon does not change the row height**, but only because its wrapper is a block-level
  `flex`. That was measured in the browser rather than assumed: inside an `inline-flex` the
  wrapper sits on the text baseline, the 16px image hangs below it, and the rows grow from 29px
  to 33px — which quietly changes what `DataTable`'s `maxRows={12}` scrollport actually shows,
  since its height is `rowHeight * maxRows` against a fixed `2rem` estimate. With `flex` the rows
  measure 29px, the same as before the icon.
- **A guard** in the `bundled wiki assets` suite resolves every `PROPS[].name` through
  `propIconSrc` and asserts the file is on disk, alongside the existing sweeps for abilities,
  items and hero art. It is deliberately forward-only: `env/` is a mixed directory that also
  holds `bomb`, `boss`, `jaula` and the `cage_ato*` sprites, so the reverse "no orphaned art"
  assertion the item and hero guards make would fail there on art that is legitimately used
  elsewhere. A renamed prop or an unbundled mirror is the failure this catches — a well-formed
  path to a file that does not exist, which type checking and the phase math tests cannot see.
