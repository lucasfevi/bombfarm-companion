---
"@bombfarm/domain": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Shows each drop's in-game art next to its label in the phase **Drop chances** panel, the same
way the two phase prop tables already show prop art.

The panel named five drops in text alone, and its rows come in wiki/yours pairs, so a gate phase
prints eight nearly identical lines that differ only by wording and a three-decimal percentage.
An icon is how players tell these apart in the game and on the wiki's own drop table, and it is
what makes a row findable without reading it.

- **`dropIconSrc(dropId)` in `@bombfarm/domain`'s `wiki-assets`** — a `Record<DropRateId, string>`
  lookup rather than a name join, because unlike props a drop's id is not its filename. Returns
  `null` for an unmapped id instead of a well-formed path to nothing.
- **A `DropIcon` component** in the web planner's `game-art` set, rendered inside the existing
  label cell and adding no row to the panel. Decorative (`alt=""`, `aria-hidden`): the label sits
  beside it and remains the accessible text.
- **Four of the five sprites show what the drop yields, not its container** — the ready key, the
  time piece, a gem, and the skill stone. That is the wiki drop table's own pairing, and the game
  indexes the same `houseparts` art as its time-part icon. Only `chest` shows a chest, because it
  yields equipment of a rolled rarity and so has no single item sprite.
- **`stone` deliberately diverges from the wiki table**, which reuses a chest there. At the 14px
  this renders at, two chests differing only in tint are indistinguishable, which defeats the
  point of the icon; a test asserts all five sprites are distinct so a future refresh cannot
  quietly collapse two rows onto one image.
- **The art is deliberately not rarity- or ato-indexed.** Every one of these has a per-rarity
  family and the game does pick within it, but a drop *chance* row is about whether the drop
  lands at all, not which grade lands — so one representative per row keeps the panel honest
  about what it measures.

`StatListItem` gains an optional **`icon`**, rendered as a sibling of the label rather than
inside it. That distinction is the whole fix, and both halves of it were measured in the browser
rather than assumed:

- A label carrying a `tip` *becomes* the tooltip trigger, so art folded into the label lands
  inside that trigger — taking the trigger's dotted underline under the sprite as well as the
  words, and widening the hover target past the text it belongs to.
- Folded in, the four "yours" rows also grew 31px → 35px. As a sibling they measure 30/31px,
  byte-identical to their pre-icon height.
- The sprite is `size-3.5`, not the `size-4` the phase tables use: this panel's rows are an
  11px/14.85px line box against the tables' 12px/16px, so 16px overflows and costs a pixel on
  every row. Tests pin both the `icon`-not-`label` wiring and the size.

Five newly bundled mirrors under `public/wiki-assets/` (`icons/chest_2`, `icons/gem_emerald_icon`,
`key/key_uncommon`, `houseparts/houseparts_rare`, `steam/stone_rare`), byte-identical to what the
wiki publishes, matching how the existing `env/` and `icons/` art is carried. A forward-only guard
resolves every modeled drop row through `dropIconSrc` and asserts the file is on disk, beside the
existing sweeps for props, abilities, items and hero art.

No drop math changed: the same wiki and yours percentages are computed and formatted as before.
