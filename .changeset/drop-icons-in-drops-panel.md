---
"@bombfarm/domain": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Shows each drop's in-game chest next to its label in the phase **Drop chances** panel, drawn at
the difficulty of the phase being viewed.

The panel named five drops in text alone, and its rows come in wiki/yours pairs, so a gate phase
prints eight nearly identical lines that differ only by wording and a three-decimal percentage.
An icon is how players tell these apart in the game, and it is what makes a row findable without
reading it.

**Every row shows the chest the drop actually arrives in**, except the ready key — a key is not
delivered in a chest, so that row shows the key itself. Four of the five are difficulty-scaled,
matching the art the game files per band and the colour language players already read (green at
Fácil through red at Inferno). The mapping is the game's own, not an invention:

- `key` → the gate key of that band's rarity. The band→rarity step is the same `1..5` the planner
  already applies in `GATE_KEY_RARITY_INDEX`.
- `time` → the House of that band. A time chest pays out house parts, so the game files its stash
  icon as the house itself rather than as a chest.
- `stone` → the skill-stone chest of that band.
- `gem` → the gem chest of that band.
- `chest` → fixed, and deliberately so: an item chest's grade follows the MAP LEVEL it drops at,
  not the difficulty, so tinting it by band would assert a relationship the game does not have.
  It uses the neutral wooden sprite the game's own item-chest icon constant points at, which
  reads as "this one is not difficulty-scaled".

`dropIconSrc(dropId, ato)` in `@bombfarm/domain`'s `wiki-assets` builds those paths, clamping an
out-of-range or non-finite band rather than composing a path to nothing. A `DropIcon` component in
the web planner's `game-art` set renders it inside the existing label cell, adding no row to the
panel, and decorative (`alt=""`, `aria-hidden`) since the label remains the accessible text.

`StatListItem` gains an optional **`icon`**, rendered as a sibling of the label rather than inside
it. That distinction is the whole fix, and both halves of it were measured in the browser rather
than assumed:

- A label carrying a `tip` *becomes* the tooltip trigger, so art folded into the label lands
  inside that trigger — taking the trigger's dotted underline under the sprite as well as the
  words, and widening the hover target past the text it belongs to.
- Folded in, the four "yours" rows also grew 31px → 35px. As a sibling they measure 30/31px,
  byte-identical to their pre-icon height.
- The sprite is `size-3.5`, not the `size-4` the phase tables use: this panel's rows are an
  11px/14.85px line box against the tables' 12px/16px, so 16px overflows and costs a pixel on
  every row. Tests pin both the `icon`-not-`label` wiring and the size.

21 newly bundled sprites under `public/wiki-assets/` — four per-band families of five, plus the
one fixed item chest. All but the gem chests are byte-identical mirrors of what the wiki serves at
the same subpath, matching how the existing `env/` and `icons/` art is carried; the wiki does not
publish gem-chest art in any form, so those five come from the game client, and the
`WIKI_ASSETS_BASE` doc names that exception rather than leaving the directory's provenance
overstated. A forward-only guard resolves all 21 paths through `dropIconSrc` and asserts each file
is on disk — every band, not just one, because a per-band family can be correct at ato 1 and dead
at ato 4.

No drop math changed: the same wiki and yours percentages are computed and formatted as before.
