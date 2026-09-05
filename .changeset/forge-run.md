---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
---

The Forge tab now forges.

**A run, from the plan panel.** Pick a piece, pick a target, set a gold budget or an attempt
limit if you want one, and press Forge. The button asks twice — `Forge to +12`, then
`Confirm — spends gold` — and the second press starts a run on your account: a safe jump to +8
when the piece is below it, then one roll per rung, paced the way the game's own screen paces
them. Where each roll lands is what the server says it is, never a guess from the odds. The run
stops when it reaches the target, when your budget or your attempt limit would be crossed by the
next roll, when the wallet cannot cover it, when the server asks for a cooldown, or when you press
`Cancel after this roll` — a roll already sent always finishes first, so the piece and the wallet
never disagree with the server.

**A rail that draws the climb.** The slot above the bag expands in place while a run is on: the
level now against the target, rolls and gold so far, the wallet, the whole climb as a stepped line
with one dot per call coloured by what it did, the last dozen marks as a strip, and a tally by rung
that folds the quiet rungs together — `+9…+11` and `+12`, not four identical lines. The plan
panel beside it does not move. When the run ends the rail shows the result in your terms —
`Reached +12`, `Stopped by the gold budget at +11`, `Out of gold at +9` — with the climb, the
counts, the wallet after and the duration; what you spent against what the plan expected and what
a bad run would have cost; and what the gold bought, the DPS the wearer actually gained against
what the plan promised, with the next rung's odds. The bag and the piece show the new level the
moment the run ends, without waiting for the next account read.

**A ledger.** Every run is kept — piece, climb, stop, rolls, fails, crits, gold — and the rail's
idle line reads the last one with the running totals. It can be cleared from the rail, behind a
confirmation.

**Two things it needs, and one it refuses.** A run starts only with "Let Forge spend gold" turned
on in Settings, and only after the second press of the button — nothing rolls on its own. Offline
mode plans but never rolls: an account with no server behind it is refused before anything is
sent, and the button says so.
