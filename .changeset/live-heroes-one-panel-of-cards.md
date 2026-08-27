---
"@bombfarm/desktop": patch
"@bombfarm/domain": patch
---

The Live screen is one Heroes panel of cards, each with its energy

The four hero lists — Field, Recovering, Waiting for a rest slot, Benched — were four separate
panels laid out two-across, so the screen read as four things that happened to be about heroes
rather than one roster in four states. They are now four subsections of a single Heroes panel,
stacked in the order a hero moves through them: Field, Resting, Idle, Benched. Each heading reads
its own count against its own cap — "Field · 7/9", "Resting · 3/5", "Idle · 4".

Each hero is a card in a grid that reflows to the window rather than a row in a list, so a full
field of nine no longer forces a column of nine lines beside three empty panels. Benched heroes are
drained of colour, which is the one state that means "not in the rotation at all".

Every card now carries an energy bar. That is what makes one Idle section enough: the list holds
both a hero at full energy waiting for a field slot and a hero part-filled waiting for a rest slot,
and until now nothing on the screen told them apart. The reading is floored, never rounded, so only
a hero at exactly full energy reads 100%; a hero whose energy was never sent says so rather than
drawing an empty bar that would claim zero.

Both caps say what raises them, while the account is below them — buying field slots in the skill
tree, moving up to a later house for rest slots. The rest-slot ceiling comes from the account's own per-house ladder when
the game sends one, so an account that differs from the reference values is measured against itself.
Each hint stays silent when its cap is unknown, rather than giving advice with no fact under it.

The House panel is gone, and every reading it carried now heads the Resting section, where the
heroes those readings are about actually are: the rest slots they are competing for, how long a full
refill takes, and how many skips the day has left — "no skips left today" once the day is spent,
rather than counting zero of fifteen. The active house and its level are no longer shown; they
named a house by a raw zero-based index and changed nothing a player does from this screen.

Countdowns now all read in one colour. They did not before: a field time the app had to model
rather than read, and a rest clock that was not advancing, were both dimmed, and a legend at the
bottom of the screen explained a dashed underline that no longer existed. A number that dims as the
live tap comes and goes reads as a different kind of number when it is the same reading from a
second-best basis. Screen readers still hear which countdowns are estimates and which are paused,
and the legend is gone.
