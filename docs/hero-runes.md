# Hero runes — a timed buff on today's sheet

**Status (2026-09-13):** the account read carries `heroes[].runas`, a list of timed stat buffs
the game applies on top of the sheet it builds from birth, gear, points and the skill tree.
`@bombfarm/domain` models them in `packages/domain/src/runes.ts`; this page is the decision on
how a buff that is real now and gone tomorrow enters each figure the two apps print.

## 1. What a rune is

One entry per rune: an axis (`attack`, `energy`, `speed`, `crit`, `critdmg`, `cdr`, `xp`,
`gold`), a strength `p` set by the rune's rarity (`WIKI_RUNES.strengthByRarity`, 5% at rarity 0
up to 25% at rarity 5), and the **play seconds** left before it expires. A rune lasts one day of
play; applying the same axis again extends the timer, up to three days. The wire never carries
the field on a hero with no rune, and the importer reads absence, `null`, or a malformed entry as
"no rune" — a rune is enrichment on a sheet that is already correct without it, so it can never
reject a hero.

## 2. Where a rune enters the arithmetic

Fitted on a live read of six runed heroes by inverting each exported sheet back to a
whole-number point vector landing exactly on its level (`runes-live-read.test.ts`):

| Axis | Form | Discriminated by |
| --- | --- | --- |
| attack, energy, speed, crit chance, cooldown | `× (1 + p)` on the **final** sheet value, after gear, points and the tree | speed — the tree's speed term is a flat add, and only the post-tree placement recovers whole points (three heroes) |
| crit damage | `× (1 + p)` on the **pre-tree excess** (birth ★ + Golpe Brutal + points), the tree's flat `crit_dmg_add` added on top | four heroes on a tree adding 68 pp — the two placements differ by ~3 points each |
| xp, gold | not sheet statistics — carried on the record, **priced nowhere** (§4) | — |

Every carrier was rarity 0; stronger runes are assumed to keep the shape. Two runes on one axis
at once were never observed and the wiki's cap is on play time, not on count.

`composeSheetFromBirth` applies the runes last. `inferSpentPoints` strips them first, which is
the whole reason the model exists: before it, a rune's `+p` was charged to spent points, the
recovered vector overshot `level − stat_points_available`, and the hero was **blocked** — every
runed hero on the account and no other. `derive()` scales each per-point delta by its axis's
factor, so a spent point on a runed hero is worth what the game pays for it today.

## 3. How each figure treats a transient buff

The rule: **a rune is what the hero hits for today, so every figure that describes today
includes it — and every figure that would justify a change on its strength must show the rune
beside the figure.**

| Surface | Includes the rune? | How it is shown |
| --- | --- | --- |
| Stats sheet (`peelSheetStages`) | yes | its own `Δ rune` column, drawn only for a hero that carries one |
| Per-statistic breakdown ledger | yes | a `× 1.05` step named "Rune", with the play time left ("22 h left") — for crit damage the step sits before the tree line, where the game puts it |
| Combat panel (DPS, hit, fuse) | yes | nothing extra: the figures are today's |
| Power panel (desktop Combat stage) | yes | the total reads as the game's own screen, runes on; while a rune is on, the stored rune-free figure is named beside it. A web save import carries no runes, so the panel is desktop only |
| Runes panel (Combat tab, under the phase pick) | — | the list itself: one tile per rune with the game's sprite for its axis and rarity, the strength, and the play time left; drawn only for a carrier, folded by default to a strip of the sprites |
| Next-point ranking, Points table | yes | a point's worth is what the game pays today |
| Farm board (gold/hr, xp/hr) | yes, through DPS | nothing extra; the board is a snapshot of the account as read |
| Optimizer / Team Plan | yes, in scoring | **a plan must never be justified by a rune** — the rune is not something the plan can buy, so the two apps name runed heroes wherever the plan explains a gain |

What a rune is **not**: an input the planner can edit. There is no rune picker on the draft, no
"what if this rune expired" toggle, and the optimizer cannot propose one. When it expires the
next account read drops it and every figure falls back on its own.

## 4. The two axes the sheet does not have

`xp` and `gold` are per-hero multipliers on what the hero earns, not on a statistic, and no
capture measures their effect — a read is a snapshot, and the one runed-on-both hero was read
once. They are parsed, carried, and shown as runes on the hero, and the Farm board's gold and
xp rates **do not price them**. Pricing them needs a paired measurement (the same hero's
per-prop gold and xp with and without the rune), held to the same standard as the sheet axes
above: never a form fitted to one account, never a constant nobody measured.

## 5. Blocked heroes, now that blocking is rare

A hero the inversion still cannot read keeps its `pts` zeroed and its candidate `blocked` — the
web planner drops it from the import as before. On the desktop, which has no import step, the
roster names such heroes (`AccountRoster.pointsUnrecovered`) and every screen that spends or
prices points withholds them rather than drawing a figure built on zero points: the Optimizer
leaves them out of the search, the Farm board leaves them off the board, and the Heroes screen
labels the selected one instead of printing its points. A labelled absence over an invented
number, per the account-fidelity rule.
