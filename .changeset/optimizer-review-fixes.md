---
"@bombfarm/web": patch
---

Two things review caught on the Optimizer.

**The per-hero table was printing DPS under a gold-per-hour heading.** When you score for gold, the total above says gold/hr and the per-hero Before/After columns are DPS — they are a different quantity and they do not add up to that total. The note under the table said the opposite, claiming those figures were "what the search actually optimizes against", which is true only when you score for damage. The note is now written per objective and says plainly that a squad's earning rate is a rate the whole rotation produces and does not divide per hero.

**Importing a second account left the editor pointed at a hero from the first.** The hero being edited is not in the new roster, and nothing re-pointed the editor at one that is — so until the page was reloaded, or a hero was clicked in the strip, every autosave had nothing valid to write. It used to write anyway, appending the stranded hero back into the roster; that was fixed separately, and this closes the other half by pointing the editor at the new roster's strongest hero, the same rule a first import already uses.
