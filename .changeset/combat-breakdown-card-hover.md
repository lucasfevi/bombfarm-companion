---
"@bombfarm/hero": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Hovering or focusing a card of the Effective stats pipeline now mutes every card not wired to it,
lights the wires on both sides of it, and opens its popover from anywhere on the card.

- **The cards it is wired to stay lit; the rest fade.** Lit means one wire away in either
  direction — what the card reads and what reads it — so hovering a sheet stat such as Attack
  shows the figure it feeds, and hovering Hit shows the three cards it reads and the two it feeds.
  The wires lit follow the same rule; before, only the wires into the hovered card lit, and no
  card was dimmed.
- **The whole card is the popover's trigger.** It used to be the card's upper face only, and the
  ability and aura icons along the bottom edge each carried a popover of their own — so a pointer
  resting on the icon row or landing on an icon opened the icon's name instead of the card's
  formula, which read as the popover not opening. The icons keep their names for screen readers
  and are no longer tab stops; the card's popover already lists them under what it reads.
- **A help cursor over every card**, matching the info tips and glossary terms, in place of the
  text cursor the labels showed and the arrow the padding showed.
