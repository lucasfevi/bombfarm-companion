---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
---

The Forge screen's Refresh goes and reads the account, instead of re-showing what was already
there.

**It never asked for a read.** Pressing it adopted whatever the background account cycle had
already committed. When that cycle had not run since the screen pinned its view — the ordinary
case a minute after opening the tab — there was nothing newer to adopt, so the press changed
nothing at all and said nothing about it. A piece forged to +12 in the game still read as
unforged in the bag after pressing it.

**Now the press asks main to read.** A new channel starts a real account read on demand and
answers with what happened, honouring the same manual-refresh floor the app's other triggered
reads already respect, so two presses in a row can never become two reads.

**Every press ends in something the reader can see.** While the read is in flight the button says
it is reading and takes no second press. If the floor refuses the press, the screen says the bag
was just read a moment ago — in those words, not a countdown. If a read cannot happen at all, it
says which of the four reasons it is: no server behind this account, the account read not
accepted in Settings, the game not open, or the game session unreadable. Both locales.
