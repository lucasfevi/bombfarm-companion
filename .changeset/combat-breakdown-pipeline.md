---
"@bombfarm/hero": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/domain": minor
"@bombfarm/ui": minor
"@bombfarm/team-plan": patch
---

The Effective stats panel on the Combat tab (web planner) and the Combat stage (desktop Heroes
screen) no longer folds each figure behind an accordion row. Both apps now draw one shared panel
from the hero package: the combat figures as a pipeline of cards — Sheet (the seven combat sheet
stats), Factors (Damage multiplier, Mitigation factor, Critical factor, Fuse, Field time, Rest),
Per hit · cadence (Hit, Critical hit, Average hit, Bombs/s, Uptime) and DPS (Active, Sustained)
— with curved wires between the cards that feed each other, so every figure is visible without a
click and Speed's card is seen feeding Bombs/s. Each card carries a short symbolic formula, and at
its bottom edge the icon of every ability or aura that reaches it — Grito on Attack, Marcha on
Speed, Presságio on Crit Chance, Brecha on Penetration, Detonação Dupla, Misericórdia, Matilha and
Passagem de Bastão on Damage multiplier, Fôlego and Bateria Extra on Field time, Explosão Ampla on
Active DPS, Contra o Relógio on Attack on a gate phase — dimmed while the aura's switch is off;
hovering an icon names the ability. Hovering or focusing a card opens one popover on both layouts:
a derived figure shows its substituted formula with every term named, the inputs it reads as
chips, and a note where the model has one (the fuse at its ceiling, an average hit equal to the
hit because crit chance is zero, what Field time would read without the team's Fôlego); a sheet
stat shows its ledger grouped by game line. Hovering a card also lights the wires that feed it.
The Mitigation factor card carries the penetration reading ("covers the phase" / "12.2% short of
this phase") that the hero panel used to print; that panel leaves the Combat stage altogether —
the hero is the one the strip or the roster holds, and the prop table goes with it (the Farm
page's hero panel keeps both). Under the pipeline, the seven combat sheet stats as a matrix — Hero
(base, level, stars and points folded to one figure; hover for the four), Gear, Ability, Skill
tree, Sheet total, Aura ×, Effective — always all seven rows, with "—" for an empty cell and "off"
where an aura exists but its switch is off; a Rune × column appears only while a rune is on the
sheet. The panel's own width picks the layout: the pipeline at 820px and up, the same cards
stacked one per row under the same four labels below that. Average hit joins the derived
breakdown as its own figure (hit × critical factor), and the Active DPS formula reads it rather
than a second damage multiplier — no value moves.

Baton Pass is now the sixth team aura behind a switch in the Abilities & auras section, beside
the five standing ones: the hero's own rank counts on its own entry pulse and cannot be switched
off; for a hero without it the switch prices that pulse at the field-wide cap (+80% for the
window), whoever would carry it, and the row says what flipping it does to sustained DPS like the
others. It leaves the own-abilities list. The drain-reductions note under the section is gone.

Both panels on the Combat tab and stage now carry their explanation behind an info glyph beside
the title, the way the Optimizer's setup bar does, instead of an intro paragraph; the Effective
stats explanation no longer describes how Baton Pass is counted. The info glyph is a design-system
primitive now, `InfoTip`, and the Optimizer draws it from there.

A hero's own Baton Pass pulse now reaches every figure a per-hero screen prints, not only the
DPS pair: Hit, Critical hit and Average hit carry the pulse's expectation over wall clock, and the
Damage multiplier card names the pulse as its own factor — so switching Baton Pass on moves Hit
the way it moves Sustained DPS. Hits-to-kill still reads the unpulsed hit (a threshold is crossed
at a level the field sits at, never at the average of two), and the Farm board's pricing is
untouched.

On a hero's own screen Baton Pass is counted as if its pulse never lapsed — the whole stint at
its level, +80% at the cap — because the screen answers what the hero is worth with the pulse on;
the Farm page and the Optimizer keep counting only the 120 s each entry lights. The Damage
multiplier card's popover says so, the aura row's figure reads "pulse held up", and the section's
info glyph explains the difference. A line under the Effective stats title says a card's figure
opens its formula on hover or focus; inside a popover the main figure stays white while every
term, step and running total is accent or muted, and the popover grows to keep a formula on one
line. The sheet-stat matrix is striped.
