---
"@bombfarm/domain": patch
"@bombfarm/desktop": patch
---

Field countdowns count down smoothly instead of stuttering

A hero's remaining field time stuttered instead of counting down steadily. Measured against a
committed capture, the underlying energy readings are noiseless — a clean linear ramp with a
single repeated per-frame delta. The stutter was ours: the countdown was `energy ÷ rate`, where
`rate` was fitted by least squares over the app's own frame-arrival timestamps, and those jitter
even though the energy behind them does not.

The countdown is now built on the energy itself as the clock: a hero's own energy drop between
two consecutive readings gives an exact frames-remaining figure with no timing input at all, and
one shared, slowly-averaged constant converts that to seconds. A dropped frame reproduces the
same per-frame drop scaled by an integer and is recognised as a skip, not a rate change; anything
else — a buff expiring, a team-aura carrier joining or leaving the field — is adopted the instant
it happens, in either direction. `basis` reports `'observed'` only once both the hero's own rate
and the shared clock are measured; either missing falls back to the modelled law exactly as
before.

The never-rising clamp from the previous fix stays as a backstop, but with an exact per-frame
delta the countdown is monotone by construction and the clamp should no longer bind in normal
operation. The rate-blend this problem previously needed — easing a carried rate toward a fresh
modelled estimate while a multi-sample fit re-earned trust — is gone: with only two readings
needed to re-measure a rate, there is no gap left for it to smooth over.
