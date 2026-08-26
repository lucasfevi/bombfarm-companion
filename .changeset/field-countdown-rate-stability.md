---
"@bombfarm/domain": patch
"@bombfarm/desktop": patch
---

Field countdowns are computed from the drain law, not measured from the frame stream

Every earlier attempt at this fix — fitting a rate from the frame stream, smoothing it, blending
it with a modelled fallback, then rebasing it on a shared frame clock — reduced the stutter without
removing it, because it was solving the wrong problem. The drain rate is not something that needs
measuring: it is a published rule the app already implements (own drain-reduction and the team's
Fôlego de Mineiro aura, additive, capped, floored) and already resolves the inputs for. A hero's
remaining field time is exactly `energy ÷ drainRate` — exact on the very first reading, with no
clock, no warm-up, and no way to jitter.

The frame-counting clock, the per-frame energy-delta tracking, the shared frames-to-seconds
constant, the skipped-frame heuristics, the trust gates, and the never-rising clamp that
compensated for their noise are gone — none of it is needed once the number is derived rather than
observed. `basis` now reports `'modelled'` for every field countdown; that used to mean an
estimate standing in for a better one, and now means exactly what it always should have: derived
from the rule, not sampled from noisy frame arrivals.

The measured rate lives on as a background check: computed cheaply from the same frames, it never
feeds the display, and logs once if it disagrees with the law by more than a small margin — the
one way the app would ever notice a hero carrying both drain-reduction effects behaving
differently than the additive rule predicts, a combination nothing has measured yet.
