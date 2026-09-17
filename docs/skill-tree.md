# Skill Tree tab

**Status (2026-09-17):** the desktop draws the account's skill tree as the game lays it out and
prices every node the player could buy next. It is read-only: buying stays in the game, and the
app calls no endpoint that would spend gold.

## What the tab shows

The tree the game draws — the hub in the middle, eight arms of small nodes and notables radiating
from it, and the unlocks (field slots and bag tabs) on the rim — with each node's owned level, the
level it can be bought to, and whether it is lit, buyable, out of gold, waiting on a prerequisite
or behind a phase gate. Selecting a node shows its effects per level, its next level's cost, the
cost to max it, and the refund undoing its top level would return. Beside the tree sit the totals
the game's own summary prints — squad damage, crit, speed, gold per target, luck, energy, the
compound (GEO) multiplier, hero XP, field slots, bag tabs — and a **Next to buy** panel that ranks
every buyable node by what one more level adds per million gold, under one of two objectives:
gold per hour, or team DPS. The objective toggle is remembered between visits.

The tab is drawn from the account read the other data screens share. When the skills section of
that read is not usable, the tab says the tree could not be read and draws nothing else.

## Web planner

The same screen ships on the web planner as a tab between Inventory and Account. Owned levels
arrive on the imported save (`skills.levels`) and persist on the account record; a browser
account written before that field existed still has the tree's totals on the Account page, but
the Skill Tree tab asks for a fresh import rather than inventing nodes. Gold per hour prints two
figures: the mean over nearby roster strengths, and the value at this roster beside it. Rates
keep three significant digits so a now→next pair does not collapse to the same compact number.

## Where the catalog and the layout come from

Two committed bundles in `@bombfarm/domain`, refreshed out of band by maintainers, the way the
phase and economy tables are:

- **The catalog** — every node's id, arm, tier, effects per level, per-level costs and refunds,
  prerequisites and phase gate — from the public wiki's data endpoint.
- **The layout** — each node's position and diameter relative to the hub — from the game's own
  skill screen placement, so the tab is the same picture the player sees in the game.

Node art is the wiki's, bundled with the other wiki assets: one medallion per notable and one per
effect kind for the small nodes and unlocks.

## The rules the tab applies

- **The hub is lit from the start.** It never appears in the owned levels and always counts at its
  full level (+5% squad damage).
- **A neighbour opens at five levels.** Every node but the hub requires exactly one parent, and the
  parent counts as held once it reaches five levels, or its own maximum when that is lower — a
  one-level unlock opens the next node at one.
- **Phase gates.** A gated node cannot be bought until the account's furthest phase reaches the
  gate, whatever its parents hold.
- **Refunds return half.** Undoing a level returns half of what that level cost, floored; a level
  that other owned nodes still depend on cannot be undone.

## How a node is priced

A node is worth the difference it makes to the farm, and only that difference: the same roster on
the same phase, once under the tree as it stands and once under the tree with the node one level
higher. The roster, pool overrides, return bonus and auras-at-cap setting are the Farm tab's own
inputs, and the phase is the one the Farm tab is set to — or, with none picked there, the phase the
account is farming now; the header says which — so the figures here agree with the board.

- **Gold per hour** runs through hits-to-kill, which is a ceiling, so a small damage node at the
  roster exactly as read is a coin toss: a whole hit per prop when it crosses a breakpoint and
  nothing when it does not. The gain is therefore taken as the mean over nearby roster strengths —
  every hero's attack scaled across ±5% in half-percent steps, both sides of the comparison scaled
  alike. Damage nodes come out stable from ±2% to ±8%; every other axis is smooth and unchanged by
  the mean. The ranking and the selected-node preview also print the figure at this roster, so the
  mean and the exact read sit side by side.
- **Team DPS** is the roster objective the Optimizer scores, evaluated with the tree's sheet totals
  and field slots moved by the node. Heroes without birth stats are left out of this figure and
  named.

Both are rankings, not predictions of the absolute rate: the terms the model holds fixed cancel
between the two sides. Pricing a full roster costs about a tenth of a second, so it is keyed by
value and recomputed only when the roster, the tree levels, the controls or the phase change — not
on every account poll.

## What is not priced

Luck, hero XP and bag tabs move neither objective. A node whose only effect is one of these is
listed with its cost and marked as paying outside both objectives; the tab does not invent a gold
value for a chest drop or a level.

## What the tab never does

It never buys, refunds or writes anything. The game exposes no purchase endpoint the app calls,
and the tab's whole output is a drawing and a ranking.
