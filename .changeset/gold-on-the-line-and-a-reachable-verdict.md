---
"@bombfarm/game-art": minor
"@bombfarm/desktop": patch
---

Gold figures sit on the line of the sentence they are in, and a run that spent what the plan said
can say so.

**A gold figure inside a sentence floated above the words beside it.** The coin and its number are
laid out as a centred flex box, and a flex box whose items are all centred has no baseline of its
own — the browser synthesises one from the bottom edge, so the whole chunk rides high. Measured in
the running app: on the Forge run band's header the spend sat 2.89px above `0 rolls` and
`wallet 16,218,906` on the same line, and on the result block's figures line each of the three
figures sat 2.56px above the separators between them. Both now read 0.00px. The figure is asked
for this explicitly, because the synthesised baseline also props a table row open by 3px: the
farm board's right-aligned gold cells keep the alignment they were built with, unchanged to the
pixel — same coin, same number, same right edge, same row height.

**A run could never be told it had spent what the plan said.** The result block has a fourth
verdict for a spend that matched the plan — no percentage, a muted phrase, neither under nor over
— and it was reached only when the spend and the expected figure were identical numbers. They
never are: the expected figure is a value iteration's float (486,379.99999993795 on a measured
piece) and the server charges whole gold. So every run within a rounding error of its plan printed
`+0%` or `−0%` beside a phrase that had picked a side. The verdict now follows the figure that is
actually printed — inside half a percent of expected, the run reads as matching the plan and prints
no percentage, whichever side of it the spend fell.
