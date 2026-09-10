---
"@bombfarm/web": minor
---

Put the whole roster on the planner, as a rail beside the hero you are editing or a board of cards
over it. The planner could only ever show one hero, and the only way to reach another was a dialog
that showed a table of names — so "which of my heroes rolled best", "which of them own this
ability", and "which are still wearing nothing" were questions you answered by opening and closing
that dialog once per hero.

The rail lists every hero best birth roll first; the board draws each one's roll as eight tinted
bars beside its ability pool and its gear, so a roster compares against itself in one look. One
toolbar governs both — sort by roll, power, level, rarity, grade or stars in either direction,
narrow to the heroes owning a given ability, or hide the ones you have taken out of the rotation —
and switching between the two shapes never changes which heroes are on screen, only how they are
drawn. Narrowing the roster is a question about the roster and never a hero switch, so the build
you are editing stays put even when the filter leaves it off the rail.

Both presentations, and the toolbar, are the ones the desktop app's Heroes screen draws, from one
implementation rather than a second copy: a change to either arrives in both, and a player who has
learned one has learned the other. The rail needs a 19rem column beside the planner, so below
1100px it is not drawn and the hero strip's own Switch hero dialog remains the way to choose.

Also fixes an ability tile nobody owns being pressable. Those tiles are shown, dimmed, because
"which of these do I have none of" is a real question about a roster — but pressing one selected a
filter no hero could match, emptying the roster with no way back but the same dimmed tile.
