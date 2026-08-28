# @bombfarm/ui

## 0.5.0

### Minor Changes

- dec4425: The desktop app's shell now uses the same sticky top-bar shape as the web planner — a brand
  lockup, a segmented Live/Planning/Settings pill, and a right-hand actions area — instead of its
  former left icon rail. The desktop's PT/EN language switch moved from Settings-only into that top
  bar (Settings keeps its own control too; both stay in sync), and the nav no longer carries icons.

  The web's segmented nav pill and its bordered PT/EN toggle are extracted into two new shared
  `@bombfarm/ui` primitives, `AppNav` and `SegmentedToggle`, so both apps render identical chrome
  from one implementation. The web's own header keeps its exact appearance and behavior; only its
  internals now call the shared primitives.

- d7c1565: Inventory cards that show the whole item, and a way to find one

  Every card now carries the game's own art: the lit rarity plate behind the icon, at the size the
  planner draws gear, and a real sprite for the things that had none — gems, keys, house parts,
  skill stones and chests. Gear lists the stats it actually gives you, with the forge already
  applied, so a +12 reads as what you get rather than what it rolled. The bottom of every card is a
  fixed row: the hero wearing it on the left, in their own rarity colour with their level, and what
  it sells for on the right, beside the coin.

  Each kind of item now gets the card it deserves. A gem has no level and no forge, so it no longer
  shows "Lv 0" — it shows its name and its tier and nothing it does not have. And because a stack of
  27 identical keys is one thing you own rather than 27, everything but gear is grouped into a
  single card with a count and the stack's total value. Chests and skill stones get their own
  sections rather than falling into "Other", which is where the app used to put them.

  Above the grid there is now a search box, sorting, and filters — by kind, by rarity, by the hero
  wearing it, by set, and equipped-only — so finding one item among several hundred does not mean
  scrolling. Search matches the item's name in your own language as well as the game's internal id.

  Filtering by set is how you filter by level: every set sits at exactly one item level, so the list
  reads "Lv 30 · Coal" and is ordered by level. It starts with everything chosen, shows how many
  pieces of each set you own — 41 beside Coal tells you it is most of your gear before you have
  filtered anything — and offers whichever of "Clear" and "Select all" would actually change
  something. Only gear has a set, so narrowing here shows gear alone.

  The English planner also stops showing Portuguese item names. Gear was being named by
  title-casing the game's own slot token, so an English player saw "Gold · Elmo" where they should
  have seen "Gold · Helm".

### Patch Changes

- dec4425: Dragging the window by its header no longer stutters or snaps back. The header carried a sticky
  position, a stacking context and a backdrop blur inherited from the web planner, none of which
  applies in a shell whose main region is the only thing that scrolls, and all of which put the
  header on its own compositing layer — the layer the OS drags once the header is the title bar.

  The header also now matches the caption strip beside it exactly, instead of sitting a shade
  darker than it.

  On the Live screen, the four field lists — on field, recovering, queued, benched — sit two to a
  row instead of four full-width rows, so the whole field reads without scrolling past whichever
  list is longest. They still stack on a narrow window.

- dec4425: Live screen and header polish from direct feedback on the running app

  `AppShell` gains an optional `brand` slot, and the shared design system exports a `BrandMark` —
  an inline rendering of the header mark's five shapes rather than a binary asset either app would
  need its own copy step for. The desktop now shows it beside its title, matching the web's own
  header mark.

  The desktop's Live screen showed two vertical scrollbars: the real one on its hero lists, plus an
  always-reserved empty gutter meant for the web's own page scroll. That gutter rule now lives only
  in the web's stylesheet.

  On the Live screen: hero avatars beside the three-line stacked identity are bigger, so the row
  reads as one block instead of a small icon dwarfed by its own text. The dashed underline under
  field/rest countdowns is gone from both the modelled and direct-reading states — the row already
  never reflowed when the basis flips (that's what the shared underline was protecting), and the
  text colour plus a screen-reader-only qualifier still carry the distinction. The standalone "Field
  slots in use" panel is gone; its count now lives in the on-field list's own header, as a plain
  `occupied/total` (or just `occupied` when the field size hasn't been sent). The on-field list
  itself is renamed "Field" ("Campo"), the name the retired panel used.

## 0.4.0

### Minor Changes

- c8a3bc8: The Phases board's Economy panel was showing XP per prop straight from the wiki, with no account
  boost applied — every other "yours" figure on that panel (gold included) already scales with your
  account, XP just didn't. It now reads a wiki/yours pair, same as gold: "yours" is the wiki value
  times your account's XP multiplier (`skills.totals.xp_mult` from your save).

  There's also a new **Drops** panel on the Phases board, showing each drop chance the game's own
  tooltip shows at that phase — item/hero chest, ready key, time chest, gem chest, stone chest —
  each as a wiki/yours pair, filtered to only the drops that actually roll on that phase (a gate
  phase shows chest + time + gem + stone; a non-gate phase shows chest + key). "Yours" is the wiki
  rate times `(1 + your on-field squad's average luck)`, reconciled against two live in-game
  tooltips.

  The Account import summary now also shows your account's XP multiplier alongside the existing
  team-coin percentage.

  The Farm Ranking board's per-phase estimate had the same two gaps, in its own separate
  computation: its XP/hr column didn't carry your account's XP multiplier either, and it modelled
  four of the five drop kinds, with no stone-chest term. XP/hr now scales the same way gold/hr
  already does, and the estimate now also accounts for stone chests on gate phases, at the same
  rate as gem chests — not yet surfaced as its own board column.

- 37c30bf: Adds a shared `DeltaTable` primitive (`@bombfarm/ui`) — a Stat / Now / Target / Change ledger
  rendered as a real `<table>` — and moves the Team Plan hero breakdowns and the Farm Respec
  Advisor's per-hero card onto it, replacing two implementations that had drifted apart.

  The Farm Respec hero card picks up the fixes the Team Plan grid already had: digits now align
  (`tabular-nums`), the Change column is coloured by sign, and the columns hold a fixed width down
  every row via `table-layout: fixed` plus an explicit `<colgroup>` — so the Luck row's "kept"
  indicator (now a compact lock glyph with a tooltip, replacing a Chip + `HelpTip` pair) can no
  longer widen the label column or grow its own row taller than the rest. The card's columns are
  also reordered to match Team Plan's chronological now → target → change (previously target-first),
  and its blank label-column header now reads "Stat". `DeltaTable` computes the change column itself
  from `now`/`target` rather than accepting it as a separate input, so the two can never disagree
  again.

### Patch Changes

- ab1c1b9: Shows each drop's in-game chest next to its label in the phase **Drop chances** panel, drawn at
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

  - A label carrying a `tip` _becomes_ the tooltip trigger, so art folded into the label lands
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
  `muitodificio`, for _difícil_ / _muito difícil_). Neither form belongs in this tree: an index
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

  **The English Drop-chances hint said "Sorte" instead of "luck".** The drop-chance boost
  breakdown above shipped with `phasesDropActualHint`'s EN copy reading "your skill tree's Sorte" —
  Portuguese leaking into the English namespace block, against this repo's own established
  convention (`stats.ts`'s `luck: "Luck"`, `gear.ts`'s `sorte: "Luck"`). Reworded to "your skill
  tree's luck" / "your squad's average luck"; the PT block, which correctly says "Sorte", is
  untouched. Four code comments in `phases-explorer.tsx` and `phase-fact-items.tsx` that said
  "Sorte" in prose are aligned to "luck" for the same reason, at no material cost to the diff.

  **The Drops panel always shows all five drop rows now, marked by phase type, instead of hiding
  the ones that cannot roll here.** A gate phase used to print 4 rows and a normal phase 2 — a
  reader comparing two phases side by side saw a different-shaped panel each time, and the layout
  math (`docs/`, `panel-field.recipe.ts`) never accounted for a row COUNT that could grow again
  later. Every row is now emitted in the fixed `chest, key, time, gem, stone` order regardless of
  phase type; a row that cannot roll on the phase being viewed is dimmed (`StatListItem` gains an
  optional `muted`, rendered as `opacity-45` on the row) and its value replaced by a dash plus a
  small note naming which phase type it IS specific to (`phasesDropGateOnly` for the three
  gate-only chests, `phasesDropNonGateOnly` for the ready key) rather than a live percentage.

  That last choice — dash, not a computed number — is deliberate: `row.actual` is still a real
  number for a drop that cannot roll here (the domain math does not gate it), but printing it next
  to a chest icon reads as "this can happen," which is false. A dash next to a dimmed, marked row
  reads as "not here" without inventing new UI vocabulary. `dropAppliesOnPhase` in
  `packages/domain/src/phase-wiki.ts` remains the one place that decides gate vs. non-gate; the
  panel only reads `DropChanceRow.applies`, never re-derives it.

  Measured in the browser on both phase types (map 1-1, non-gate, and map 1-10, a gate): the row
  count is 5 either way, the row list is 228px tall (was 181px at 4 rows), and the panel itself
  stays at 404.8px — byte-identical between the two phases and unchanged from before this PR, since
  its height still comes from the board grid rather than its content.

  **Final copy pass.** The key row is labelled just "Key" / "Chave" — "Ready key" carried the game's
  internal `keyDropRate` phrasing into the UI, where the qualifier says nothing a player needs. And
  the gate/non-gate sentence moves out of the per-row boost tooltip into the panel's section
  description: it describes the whole panel rather than any one row's arithmetic, so repeating it in
  every row's tooltip made the tooltip say two unrelated things and hid a panel-level fact behind a
  hover. It uses the same `tipClass` the Hero panel's section description already uses.

- 387f85c: Reworks the Farm Ranking board's rotation pool row and filter placement.

  Each rotation pool chip now shows the hero's identity — avatar, rank, name, rarity and level —
  via the shared `HeroIdentityChip`, instead of a bare truncated name next to a switch. The chip
  uses a new `stacked` variant that pins it to three lines (rank+name / rarity / level) and omits
  the record id, so a grid of chips keeps one uniform height; the enable switch sits on the right
  edge of the chip. A disabled hero's identity dims and desaturates so the toggled-off state reads
  clearly beyond the switch alone.

  The unlocked/difficulty/gate filters and the return bonus picker move from the top of
  the panel down to sit directly above the ranking table (and above the "no phases match" empty
  state, so a fully-filtered board still exposes the controls needed to undo it), separated from
  the respec toolbar above by a thin divider. Those fields now share a fixed label and control
  height, so their labels and controls no longer sit on ragged baselines when one field carries a
  help tip and its neighbours are taller selects.

  A further pass over the same board:

  - Removed the FEASIBLE column and the "Feasible only" filter switch from the UI. The underlying
    `infeasible` row field and its domain computation are untouched — only the board's own column
    and filter went away.
  - The difficulty filter now lists the in-game difficulty names (Easy / Normal / Hard / Very Hard
    / Inferno, localised) instead of the bare numbers 1-5.
  - The "Show ranking under this build" re-rank toggle now only appears once Optimize has produced
    a fresh proposed build, instead of being always mounted above the table.
  - The Phase column and the respec headline now print the in-game coordinate — `Normal 1-1 (#51)`
    — instead of the wiki flavour name, so the board reads the same way the in-game map picker does.
  - The Mitigation column now prints its `%` sign.

  A fourth pass, focused on the table's overall fit and readability:

  - The Gold, Item chest, Key, Gem chest and Time chest columns now carry the matching in-game
    icon at a readable size (the same `size-8` art the Drops panel already uses), all drawn from
    the Inferno/mythic band. The Chests/Keys/Gems/Time pieces headers are reworded to the Drops
    panel's own chest-equivalent vocabulary ("Item chest", "Key", "Gem chest", "Time chest") instead
    of naming the loose resource.
  - Every rate column header drops its "/hr" suffix; each cell now states its own unit instead
    ("949.8k/h", "+6.0/h" for the signed keys column).
  - The Cage window column is removed from the table entirely — the underlying early-arrival cap
    and guaranteed window are unchanged and still shown on the Phase explorer's own Cage panel.
  - These three changes together let the table fit within a typical desktop viewport without a
    horizontal scrollbar; the table's minimum width drops from 93rem to 77rem.
  - The table header now stays pinned while only the row body scrolls underneath it, both on a tall
    row set and on a narrow viewport that still needs to scroll horizontally.

  A fifth pass, on the same five icon headers:

  - The Gold, Item chest, Key, Gem chest and Time chest headers now show only the sprite, on one
    line — the label that used to sit under it (stacking every header into two tiers) survives as
    screen-reader-only text and as a hover tooltip on the sprite instead. Sort chevrons, `aria-sort`
    and the sort announcement are unaffected.
  - Column widths are retuned now that those five headers no longer need to fit a word under the
    icon: the table's minimum width drops from 77rem to 68rem, closing the horizontal scrollbar
    that a 1280px-wide viewport used to show.

  A sixth pass, on the row's own gate marker and its resource columns:

  - The Key column's cell no longer prints a trailing "consumed" annotation on gate rows — it reads
    the signed rate alone (e.g. `-15.5/h`), the same shape a non-gate row's gain already has. This
    also frees width the annotation used to reserve, so the table's minimum width drops from 68rem to
    66.5rem.
  - The row's "Gate" chip is replaced by the game's own gate-timer clock icon, with the same word
    carried as a hover tooltip and as always-present screen-reader-only text — the marker stays
    mounted on every row (only visually hidden on non-gate ones), so no row height changes.
  - The Gem chest and Time chest cells now dim and print an em dash on non-gate rows, matching the
    Drops panel's existing treatment of a figure that cannot roll on the phase being viewed — those
    two chests only ever drop on a gate. The Item chest, Gold, XP and Key cells are unaffected: the
    first three always apply, and the Key cell states a real net rate on every row.

  A seventh pass, trimming row height:

  - The "Push target" badge on locked phases is withdrawn for now. It sat beside the phase label and
    wrapped onto a second line, growing every row it appeared on; the unlocked-only filter remains the
    way to include or exclude locked phases.
  - The Gold column's header coin is sized down a step so it reads at the same visual weight as the
    four chest sprites beside it.

  An eighth pass, virtualizing the row body:

  - The table body now mounts only the rows scrolled into view (plus a small overscan band), instead
    of every row the current filters match. Turning off "unlocked only" used to mount all 600 phase
    rows at once — a measured ~150ms hitch on that click, and every row stayed a `content-visibility:
auto` DOM node even offscreen, which is also the likely cause of the scrollbar/scroll-position
    oddities that property is known to cause. Expanding to 600 rows now mounts under 30 and lands
    under 20ms.
  - `aria-rowcount` on the table and `aria-rowindex` on each row now state the full filtered row
    count and each row's position within it — the same "no row was silently dropped by a filter"
    guarantee a full DOM row count used to prove, expressed in a form that still holds once only a
    window of rows is mounted.
  - Every body row now carries an explicit, CSS-enforced height (33px — the row's real rendered
    height, not the 44px the row's earlier `rowHeight` value assumed) instead of an unconstrained
    one, so the scroll math, the spacer rows and the scrollbar all agree with what is actually on
    screen; the visible row count feeding the window itself scales off that same real height so the
    table keeps its current visible density (about 19 rows) rather than the ~14 the old, wrong
    assumption implied.

- 37c30bf: An untouched stat row in the change tables is dimmed with the muted text colour instead of a
  flat opacity, which keeps it readable against the WCAG AA contrast floor. The Payback label
  matches the uppercase of the tiles beside it, and the advisor no longer carries a "this build
  earns less gold" message that a gold-only optimizer can never produce.
- 37c30bf: Reworks the Farm Respec Advisor's metric tile row.

  The Gold/hr and Chests/hr tiles now carry the game's own coin and chest icons beside their
  labels, and each one's `current → proposed` value carries its own signed percent change alongside
  it (e.g. "171,081 → 180,075 (+5.3%)") — `@bombfarm/domain` exposes this as two new signed fields,
  `goldGainPct` and `chestsGainPct`, on `FarmRespecResult`. Unlike the existing `gainPct` (the
  active objective's value, clamped `>= 0`), these two are deliberately unclamped: whichever
  currency is not being optimized can legitimately fall, and a clamped-to-zero percent would
  contradict the tile's own "gives up N gold/hr for this objective" note sitting right next to it.

  A new "Phase" tile sits between the rate tiles and the cost/payback tiles, showing the recommended
  phase to farm before and after the proposed respec (`Easy 3-7 (#27) → Normal 1-1 (#51)`), so the
  phase change driving the gold/chest numbers is visible without leaving the panel. When the
  proposal does not move the phase, the tile shows the phase once plus a small "(same phase)" note
  instead of printing the identical label twice. The tile row now spans 2/3/5 columns at
  mobile/tablet/desktop widths to fit the fifth tile.

  The Payback tile's label is now itself the tooltip trigger (a dotted underline, matching
  `@bombfarm/ui`'s existing `StatList` glossary-term idiom) explaining what the figure actually
  divides — the respec cost by the _increase_ in gold/hr the new build earns, not the new rate on
  its own — after players misread "pays for itself in 0.3 h" as computed against the new gold/hr
  alone. `@bombfarm/ui` exports its existing `TipLabel` primitive from the barrel for this.

  `@bombfarm/domain` also adds `chestIconSrc()` next to the existing `goldIconSrc()`, sourcing the
  same sprite `dropIconSrc('chest', ato)` already used for the neutral, difficulty-independent
  item-chest icon.

- 387f85c: Fixes the sortable DataTable column header's hover so it fills the whole header cell instead of
  a smaller inset box — most visible on headers taller than their own label, like Farm Ranking's
  sprite-icon columns, where the fill used to stop partway down the cell leaving an unfilled band.

  The hover is also restyled for the theme: a full-cell accent wash, the label lifting from muted
  to ink, and a crisp accent rule along the cell's bottom edge as a sort affordance, gated by
  `motion-safe`. Hover stays visually secondary to the active/sorted column, which still carries
  its own persistent accent-colored label and direction chevron regardless of hover. The
  keyboard focus ring now also spans the full cell rather than the button's own smaller box.

  Glossary terms get their keyboard focus ring back. It was written with the bare `outline`
  utility next to `outline-2`, which tailwind-merge treats as one conflict group, so the pair
  collapsed and left the outline style unset.

  The Phases panels now name rarities in English in the English locale. They printed the
  Portuguese names ("Comum", "Incomum", …) regardless of language, unlike every other surface.
  The phase Gold row's label follows: "Gold (Common)" rather than "Gold (Comum)" — Comum is the
  rarity tier the base figure is quoted at, which every other prop scales up from.

## 0.3.0

### Minor Changes

- fc7fcf1: **Every player-facing and internal surface that could still express the five removed keystones is
  gone.** `@bombfarm/domain` stopped modelling Abisso, Glass Cannon and Tempo Dobrado; this
  change removes the last ways a player or a maintainer could still see, toggle, persist or key on
  them.

  **Removed controls (`@bombfarm/web`, rendered Account panel, both `pt` and `en`):**

  - The three `Switch` toggles — **Abisso**, **Glass Cannon**, **Tempo Dobrado** — and their On/Off
    status readouts. The Skill Tree subsection is now six read-only `<output>` rows with no input,
    button or switch/checkbox role anywhere inside it.
  - The three conditional import-preview rows in the account-import summary.
  - The advice column's forwarding of the two keystone-only fields into the breakdown model.

  **Removed i18n keys, EN and PT-BR (12 keys × 2 languages):** `treeGlassCannon`,
  `treeGlassCannonHint`, `treeAbisso`, `treeAbissoHint`, `treeTempoDobrado`,
  `treeTempoDobradoHint`, `keystoneOn`/`keystoneOff` (PT `Sim`/`Não`), `importKeystoneOn` (PT
  `Ativo`), `bdNoteGlassCannon`, `bdNoteTempoDobrado`, `bdTermAbisso`. Surviving prose in both
  languages (account hints, the damage formula's `× abisso` factor, and the planner's explain-section
  text) no longer names any of the three mechanics.

  **Removed `TreeState` fields (`@bombfarm/web`):** `glassCannon`, `tempoDobrado`, `abisso`,
  `abissoBase`, `critDmgMult` — gone from the type, `DEFAULT_TREE`, every selector, the store's
  setters (`setTreeGlassCannon`, `setTreeTempoDobrado`, `setTreeAbisso`) and the team-plan input
  builder. A stored account written before this change still loads; the dead fields are discarded on
  normalize, not fatal.

  **Removed `@bombfarm/ui` exports:** `accountKeystoneControlClass` and
  `accountKeystoneStatusClass` (`panel-field.recipe.ts`), plus the two `[&_label_[data-keystone-control]]`
  arbitrary variants inside `stackFieldsClass`. The Storybook `switch.stories.tsx` stories keep their
  ids and count (3 → 3), re-labelled and re-skinned onto a surviving row.

  **`@bombfarm/desktop` (internal, no user-facing change):** `CHANGE_KEY_INPUTS` and
  `sharedChangeKey` no longer key on the four dead tree paths, and `account-model.ts` no longer maps
  the five fields into the shared account shape.

## 0.2.0

### Minor Changes

- dc82f15: `AppShell` grows into a sidebar nav + content area + status bar (data-driven `items`, controlled `activeId`/`onNavigate`; an empty/omitted `items` renders no nav rail). Adds `StatusChip`, the single implementation of the game-connection states (connected / not running / stale, with an optional age label), and `EmptyState` for "no game / no items / no filter matches" placeholders. The sidebar collapses to icons-only below the `compact` breakpoint; collapsed labels stay in the accessibility tree.

  The desktop renderer adopts all three: its hand-rolled `formatStatus`/`statusClass` helpers and hardcoded `emerald`/`amber`/`--bf-*` classes are gone in favor of `StatusChip` and token-based chrome, and the "preload bridge unavailable" / "no snapshot yet" states now render through `EmptyState`.

- dc82f15: Adds the toast system DESIGN_SYSTEM.md §11 specifies: a pure, node-testable queue reducer (`toast-queue.ts`) implementing key-based coalescing, a 3-visible/"+N more" overflow stack, severity-dependent auto-dismiss, and threshold-gated progress announcements, plus `ToastProvider`/`useToast`/`ToastViewport`/`ToastItem` built on a plain portal (base-ui's `Toast` couples every rendered toast to its own internal store and timers, which would fight this feature's single-source-of-truth reducer — see `design.md`'s T1 finding). Also adds `NotificationCenter` (a controlled ring-buffer view), `Slider` (a `@base-ui/react/slider` wrap), and the `SettingsSection`/`SettingsRow`/`SaveBar` settings-form primitives.

  The legacy `Toast` stays byte-compatible for `apps/web`'s planner and now carries a `@deprecated` JSDoc pointing at `useToast`. `toast.recipe.ts` is untouched.

### Patch Changes

- dc82f15: Storybook ownership moves from `apps/web` (`@storybook/nextjs`) to `packages/ui`
  (`@storybook/react-vite`) — the catalog now lives with the package it documents.
  Fonts are self-hosted via `@fontsource` instead of `next/font/google`. Adds
  `@storybook/addon-a11y` and a `@storybook/test-runner` gate (`pnpm --filter
@bombfarm/ui test-storybook`) that smoke-renders every story and asserts zero
  accessibility violations, wired into CI on the existing `web` path filter.

  Fixing the a11y violations the new gate found touches a few components' visible
  chrome: `Banner` now renders a `<div role="status">` instead of `<aside
role="status">` (an `<aside>`'s implicit landmark role doesn't permit overriding to
  `status`); the "warn" chip/`StatusChip` tone and `AbilityCard`'s locked-out dimming
  and `Panel`'s unverified dimming are all slightly lighter, raised to clear WCAG AA
  contrast; `FileDropZone`'s inner "Choose file" control is no longer a second
  keyboard tab stop (it was decorative — the drop zone's own `role="button"` wrapper
  already handled activation).

  `apps/web` no longer hosts or depends on Storybook.

- dc82f15: Housekeeping after the Storybook move, no runtime behaviour change. `apps/web`'s
  TypeScript config no longer includes the deleted local `.storybook/` directory, and
  root ESLint now lints `packages/ui` story files (with type checking off, since they
  sit outside the package tsconfig) so the raw `react-icons` / `*.svg` import ban that
  guards the `Icon` seam applies to stories too, not just to product code.

## 0.1.0

### Minor Changes

- d2116e5: Add the `Icon` seam to `@bombfarm/ui`: closed `IconName` union over a UI-chrome registry (`react-icons`), design-system migrations, Storybook gallery, and lint enforcement. Game glyphs are out of scope.

### Patch Changes

- 6ca8b4a: Centralize design tokens in `@bombfarm/ui` (M2): shared `@theme`, typed mirror, WCAG contrast tests, and unified web/desktop palette.
