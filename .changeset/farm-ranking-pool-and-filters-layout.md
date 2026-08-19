---
"@bombfarm/web": patch
"@bombfarm/domain": patch
"@bombfarm/ui": patch
---

Reworks the Farm Ranking board's rotation pool row and filter placement.

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
