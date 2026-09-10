---
"@bombfarm/desktop": minor
---

Say which phase a hero's combat numbers are for, and let you ask about another one.

**The Heroes screen opens on the phase your Farm screen is set to.** Damage, hits to kill and time
on field are all answers about one stage, and a hero's numbers mean nothing without one. The screen
now names the phase it computed at, and says in so many words that the phase came from your Farm
screen.

**You can point it at a different phase, and it says that too.** Typing another phase recomputes
everything at that phase and labels it as your own choice rather than as Farm's. It stays put while
you switch between heroes, which is the reason to set it at all — comparing two heroes at one
phase. One button hands the screen back to the Farm phase.

**Your Farm screen does not move.** The override is local to this screen, in both directions: Farm
never learns about it, and the phase Farm remembers is exactly the phase Farm remembers. Leaving
the Heroes screen and coming back opens on the Farm phase again — nothing about the override is
stored anywhere.

**A phase the game does not have gets no numbers.** Asking about a phase past the end of the game
is answered at the last real one, and a field left with nothing in it draws no figures at all
rather than confident-looking numbers about a stage that does not exist.
