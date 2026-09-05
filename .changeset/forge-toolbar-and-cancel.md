---
"@bombfarm/desktop": minor
---

The Forge toolbar looks for pieces worth forging, and the cancel says the press landed.

**The forge filter counts down, not up.** It used to offer `+8 and up` and `+9 and up`, which
finds the pieces already forged high — the opposite of what this screen is for. It is a ceiling
now: `Forged up to +8` keeps the pieces that still have a climb ahead of them, with `+0 only` for
the untouched, `+14` for everything short of maxed, and `Any forge` still the default. `+8` is
there because it is the safe floor, the last rung reachable without a roll that can wipe the
piece.

**A filter for what a hero is wearing.** Worn by a hero, worn by nobody, or both. Picking a hero
already means "worn, by that hero", so with one chosen this stops offering a second cut and says
so rather than quietly emptying the table.

**The order picker is back.** Rarity and level lost their columns from the bag, and with them the
only way to order by either. The toolbar now carries the same order control the Inventory list
has, and it names whichever order is leading — including one chosen from the Item, Slot or Forge
column headers, which still sort from the header.

**The bag-slot counter is gone.** How many bag slots are free is not what this screen decides
about. The read age beside it stays.

**The item panel.** Its title reads `Item`. Its stat table drew the stat name a size smaller than
the figures beside it, on a shorter line, which tilted `+13`, `+14` and `Change` off the label's
baseline and made one row taller than the next. Every cell in a row now shares one size and one
line, with the figures right-aligned in the fixed-width face.

**`Cancel after this roll` says the press landed.** The cancel is honoured between rolls, so for
a second or two after pressing it nothing used to change and the button invited a second press.
It now disables itself and reads `Cancelling after this roll…` until the run ends, in the run band
and in the plan panel both, with the line under the button saying the app is waiting for the roll
in flight to settle.
