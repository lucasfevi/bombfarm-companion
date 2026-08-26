---
"@bombfarm/domain": patch
"@bombfarm/desktop": patch
---

Field countdowns count down instead of flickering

A hero's remaining field time flickered up and down instead of counting steadily. Measured
against a committed capture, the underlying energy readings are noiseless — a clean linear ramp
with a single repeated per-frame delta. The wobble was ours: whenever the on-field team's aura
composition changed, the hero's rolling sample window was discarded and the countdown fell back
to a modelled rate for a couple of seconds until a fresh fit earned trust again, and the modelled
law never agrees exactly with a hero's measured rate, so every transition was a visible step.

Three changes, composing:

A composition change now carries the hero's last trusted measured rate forward and eases it
toward the new modelled estimate over a short interval, instead of stepping to the modelled value
immediately. A carried or blending rate is always reported with a `modelled` basis, never
`observed` — the screen's estimate marker still flips on a genuine composition change, exactly as
it should.

A trusted fit now reports its remaining time by solving the fitted line for when energy reaches
zero, rather than dividing a single jittery reading by the fitted rate. The two agree exactly on
clean data; the change only removes noise the division was exposed to.

A hero's displayed remaining time no longer rises while it stays on the field and its own energy
has not increased. The clamp releases the moment energy genuinely rises (a recharge) or the hero
leaves and returns.
