---
"@bombfarm/hero": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/domain": patch
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
this phase") that the hero panel used to print; the hero panel on the Combat stage keeps only the
phase note and the hero switcher, and the prop table is gone from that stage (the Farm page's
hero panel keeps both). Under the pipeline, the seven combat sheet stats as a matrix — Hero
(base, level, stars and points folded to one figure; hover for the four), Gear, Ability, Skill
tree, Sheet total, Aura ×, Effective — always all seven rows, with "—" for an empty cell and "off"
where an aura exists but its switch is off; a Rune × column appears only while a rune is on the
sheet. The panel's own width picks the layout: the pipeline at 820px and up, the same cards
stacked one per row under the same four labels below that. Average hit joins the derived
breakdown as its own figure (hit × critical factor), and the Active DPS formula reads it rather
than a second damage multiplier — no value moves.
