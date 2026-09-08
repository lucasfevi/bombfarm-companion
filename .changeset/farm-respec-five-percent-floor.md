---
"@bombfarm/domain": major
"@bombfarm/farm": major
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Make the Farm Respec Advisor's Optimize button permanent, and drop the background estimate that
used to decide whether it appeared at all.

The board ran a fast estimate on every roster change and showed the control only when that
estimate cleared 1%. The estimate is a deliberate lower bound, and it under-reports badly: across
the committed captures it recovered between 33% and 70% of the gain the real search finds, so an
account with a genuine double-digit respec available could be told nothing and offered no way to
ask. Raising the bar would have made that worse, not better. The estimate is gone entirely — one
whole tier of the solver, its memo, its dependency tuple and its toolbar callout — and Optimize is
now always pressable, on any roster, whatever the board thinks.

The 5% floor moves onto the number it can actually speak for. Pressing Optimize runs the full
search as before; if the best build it finds is worth less than 5% more gold per hour, the panel
says so and names the figure it found, rather than laying out a per-hero respec that costs more
than it returns. A build that is already optimal and one that is merely close now give the same
honest answer. Above the floor nothing changes: the gain, the phase, the cost, the payback, the
per-hero split and the cheaper-respec frontier all render exactly as before.
