---
"@bombfarm/game-art": minor
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Add `SpriteLoop`, a shared preloading, reduced-motion-aware pixel-art frame loop, generalised out
of the web team-plan optimizing modal's hero6 bomb-activation animation so both apps can reuse the
same implementation. The web modal's own animation is unchanged.

The desktop Live tab's "waiting for the first account read" screen now shows a small pulsing cue
while the app is reading the account or retrying a connection gap on its own, so a long wait reads
as working rather than stalled. The cue stays static while consent is missing, since nothing is
actually in progress in that state, and it honours reduced-motion settings.
