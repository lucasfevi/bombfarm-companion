---
"@bombfarm/game-art": minor
"@bombfarm/desktop": patch
"@bombfarm/web": patch
---

An item now reads the same way everywhere it is named.

**One shape, four surfaces.** The inventory cards, the inventory list, the Forge screen's item
panel and the Forge screen's list each drew a piece their own way: the card put the forge level on
the second line beside the tier, the list put it beside the name, the Forge screen ran the tier,
the slot, the level and the forge together into one grey line. All four now draw the same block —
the item's art, its name and its forge level on the first line, its tier and its level on the
second — so a piece you recognise on one screen is the same piece on the next.

**The level is written one way.** It was three: `Level 60` on the desktop inventory, `Nível 60` in
Portuguese, and a run-together `nv60` on the Forge screen. It is `Lv 60` everywhere now, and
`Nv 60` in Portuguese — the same abbreviation the app already uses for a hero's level.

**Names keep their tier colour where the tier has nowhere else to go.** A key, a house part or a
skill stone is named by its tier, so the name itself carries the colour; everything else carries
it on the tier word under the name. The forge level keeps the accent it had in the list, and an
unforged piece still prints nothing rather than a `+0`.
