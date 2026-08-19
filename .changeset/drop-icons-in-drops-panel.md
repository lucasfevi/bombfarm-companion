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

**The bundled drop sprites are renamed on the way in, to English difficulty words.** Upstream
files the five bands inconsistently — bare indices on some families (`chest_skill_1`…`_5`,
`house_house_1`…`_5`) and Portuguese words on others, two of them misspelled (`dificio`,
`muitodificio`, for *difícil* / *muito difícil*). Neither form belongs in this tree: an index
leaves a reader decoding `_4`, and the misspellings would carry another project's typos into a
public repository. They are now `chests/gem_chest_very_hard.png`,
`chests/skill_stone_chest_easy.png`, `houses/house_inferno.png` and so on, off one
`DIFFICULTY_SLUG` table taken from `GAME_DIFFICULTY_EN`. The meaningless `steam/` directory and
the doubled `house_house` are gone with it, and `icons/chest_0.png` is now `chests/item_chest.png`.

Renaming costs the property that a local path tells you where the file came from, so
`docs/bundled-art-provenance.md` records the upstream path for each one — that table, not the
directory listing, is what a refresh has to be driven from. The guard sweeps all 21 paths across
every band, and is sharper than the equivalent prop sweep for the same reason: these names are
this repo's own, so nothing upstream would ever disagree with a typo in one.

Gate keys are deliberately left filed by rarity (`key/key_mythic.png`, not `key_inferno`): the art
IS the rarity's key, and the band→rarity step belongs in `GATE_KEY_RARITY_INDEX` where it is
visible, not buried in a filename.

**The boost tooltip moves off the label and onto the subtext, and the drop-chance breakdown gains
its missing skill-tree term.** Two follow-on fixes to the merged row above:

- The label stopped being the tooltip trigger. With the boosted total and its breakdown already
  printed on the row, hovering the plain word "Item chest" to learn what boosted it was one
  interaction too many — the arithmetic is the thing worth explaining, so the dotted underline
  moves onto the subtext line itself (`TipLabel` now wraps the subtext, not the label). The three
  now-unused `phasesBoost*` strings (`luck`/`team coin`/`XP mult`) are removed with it — the
  trailing source word they supplied is gone from the subtext, which now reads `167 + 56%` and
  `0.100% + 17%` rather than `167 +56% mult. XP`. The three surviving hint strings say "base
  value" in place of "Wiki": the merged row already prints the wiki number inline, so naming it a
  second time in the tooltip was the confusing name, not the helpful one.
- **Drop chances decompose into base + skill-tree Sorte + squad Sorte**, in that order, matching
  the order the tooltip explains them in — `0.100% + 20% + 5%`. `farm-rate.ts` already tracks
  these as two separate quantities (`treeLuckFlatPct` and the uptime-weighted `heroLuckPct`,
  peeled apart specifically so the tree's flat add is never double-counted); `phase-intel.ts`
  previously only accepted the pre-collapsed sum. `PhaseIntelGlobalOptions` gains
  `treeLuckFlatPct`/`squadLuckPct` as pure DISPLAY echoes — they do not feed `dropChances[].actual`,
  which stays driven by `luckFraction` alone, so every existing caller and the account-486 witness
  keep working unchanged. `phases-explorer.tsx` derives `squadLuckPct` as
  `luckFraction * 100 - treeLuckFlatPct` rather than re-averaging independently, so the two terms
  sum to the combined figure by construction. `dropItems` falls back to a single combined term
  when a caller does not supply the split (both default to `0`), rather than inventing a two-way
  divide it was never given — this is the path the account-486 witness test still exercises,
  since that witness only ever measured the two heroes' combined average, not a tree/squad
  breakdown.

Gold and XP get the same subtext-tooltip treatment but **stay single-term** — `167 + 56%`, not a
fabricated split. Both were checked against `farm-rate.ts` before assuming a squad share existed:
`teamCoinMult` and `xpMult` are read straight off `account.tree` with no per-hero averaging
anywhere in the pipeline, so the model genuinely has only one contributing source for either
figure. `avgGold`/`mapGold` gain a tooltip they never had (`phasesGoldActualHint`, same as the
`gold` row they share their math with) as a small, deliberate side effect of unifying every
boosted row on the same subtext-tooltip shape rather than keeping one row an exception.
