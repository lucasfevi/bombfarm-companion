---
"@bombfarm/domain": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Shows each drop's in-game chest next to its label in the phase **Drop chances** panel, drawn at
the difficulty of the phase being viewed.

The panel named five drops in text alone, and its rows came in wiki/yours pairs, so a gate phase
printed eight nearly identical lines that differed only by wording and a three-decimal percentage.
An icon is how players tell these apart in the game, and it is what makes a row findable without
reading it. Those pairs are merged into one row each further down, which is what makes room to
draw the art at a size worth reading.

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
- Folded in, the rows also grew 31px → 35px. As a sibling of the label they took their pre-icon
  height back exactly. (The row merge below then grows them deliberately, to 47px, which is a
  different decision made for a different reason.)

21 newly bundled sprites under `public/wiki-assets/` — four per-band families of five, plus the
one fixed item chest. All but the gem chests are byte-identical mirrors of what the wiki serves at
the same subpath, matching how the existing `env/` and `icons/` art is carried; the wiki does not
publish gem-chest art in any form, so those five come from the game client, and the
`WIKI_ASSETS_BASE` doc names that exception rather than leaving the directory's provenance
overstated. A forward-only guard resolves all 21 paths through `dropIconSrc` and asserts each file
is on disk — every band, not just one, because a per-band family can be correct at ato 1 and dead
at ato 4.

No drop math changed: the same wiki and yours figures are computed and formatted as before — the
change is which of them a row leads with, and how many rows it takes to say it.

**The wiki/yours row PAIRS are merged into one row per figure**, in both the Drops panel and
Economy. Each row now leads with the boosted total and carries the wiki base and the boost that
produced it as subtext — `0.117%` over `0.100% +17% sorte`. The pair stated both numbers but left
the reader to divide one by the other to see the boost at all, and it cost two rows per figure:
eight on a gate phase's Drops panel, differing only by a parenthesised word.

- A row with no boost prints the bare total and no subtext. With no save imported every multiplier
  is 1, and `0.100% +0% luck` restates the total while implying a boost that is not there.
- Economy's XP row merges on the same terms, so the panel does not mix both shapes, and its three
  gold rows move the coin from the value to the label — the coin marks what the ROW is about, so
  it belongs with the row's name. A new `GoldIcon` does that; `GoldValue` is untouched and still
  prefixes coins to inline figures in the four other surfaces that use it.
- The merge is what pays for `size-8` (32px) drop art, up from 14px. A gate phase prints four rows
  where it printed eight, and the panel's height comes from the board grid rather than its
  content. Measured: rows go to 47px, the list fills 181px of the panel's 405px, and the panel
  does not move. The taller row also absorbs the subtext line for free.

Every merged label drops its `(wiki)`/`(yours)` suffix, so ten drop keys and eight economy keys are
replaced by nine single-label keys plus three naming the boost SOURCE (`luck`, `team coin`,
`XP mult`). `phasesXpPerProp` is revived at the frozen fixture's own value, so it leaves
`KEYS_REMOVED` rather than becoming a declared delta.

The account-486 live-tooltip witness is preserved through the change rather than relaxed: the
tests read the two lines back out of the value node and still assert `167 -> 261` and `194 -> 303`
for XP, and the four gate drop totals, as numbers.
