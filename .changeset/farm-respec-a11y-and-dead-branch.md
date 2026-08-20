---
"@bombfarm/web": patch
"@bombfarm/ui": patch
---

An untouched stat row in the change tables is dimmed with the muted text colour instead of a
flat opacity, which keeps it readable against the WCAG AA contrast floor. The Payback label
matches the uppercase of the tiles beside it, and the advisor no longer carries a "this build
earns less gold" message that a gold-only optimizer can never produce.
