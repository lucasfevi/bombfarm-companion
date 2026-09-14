---
"@bombfarm/hero": minor
"@bombfarm/desktop": minor
"@bombfarm/game-art": minor
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Draw the equipped items on the desktop's Gear stage — art in its rarity frame, name, tier, level,
forge and the slot it sits in — instead of eight bare stat cards.

The Heroes screen's Gear stage used to print only each slot's stat contributions ("Damage
+6,733.7 / Crit Chance +15.0%") with nothing saying which item they came from. It now draws the
same slot card the web planner draws: the slot's name on top, the item's art centred in its rarity
frame, the item's name with its forge `+N`, its tier in the tier's colour beside its level, and
the stats it contributes beneath. An empty slot shows a dashed tile and "Empty". The stage stays
read-only — no control on it changes the loadout.

One card for both hosts. `GearSlotCard` lives in `@bombfarm/hero`; the shared Items panel draws it
whenever a host supplies no slot editor, and the web planner's editor now wraps the same card,
handing its level, rarity and forge selects in as the card's children — so the per-slot stats that
used to sit in a second row under the editors now sit inside each card, under the item they
belong to. The eight slots are laid out four across in two rows rather than eight across: at the
widths the panel really gets, eight across left each card ~106px and abbreviated every item name.
