---
"@bombfarm/desktop": patch
"@bombfarm/domain": patch
---

Fix the energy bar and percentage on the Live tab lagging up to a minute behind the countdown
printed beside them. The countdown was refreshed four times a second, but the percentage came from
the authenticated account read that only lands once a minute, so a hero could sit at "0:00" with a
bar still reading 99% — two numbers describing the same hero, disagreeing. Both readings now come
from the same fast channel: a hero on the field shows the energy the live stream actually observed,
and a hero resting shows the exact inverse of the recovery clock next to it, so the bar reaches full
at the instant the clock runs out. Queued and benched heroes have no live reading available and are
unchanged.
