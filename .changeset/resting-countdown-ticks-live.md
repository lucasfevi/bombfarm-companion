---
"@bombfarm/domain": patch
"@bombfarm/desktop": patch
---

The resting countdown now ticks in real time instead of jumping once a minute

A resting hero's recovery countdown carried no time term at all — it was recomputed only when the
account was re-read, roughly once a minute, and sat perfectly still in between while still
reporting itself as advancing. It looked like a running clock and was actually a value that jumped
once a minute and held flat the rest of the time.

Recovery is a straight linear ramp over the house cycle, so it is now interpolated in real time
from the last read: `remaining(now) = remainingAtRead - (now - readAt)`, floored at zero. Unlike
the field countdown this is a subtraction, not a division, so a small timing error stays small.

A hero recovers in the house on the server's own clock whether or not a battle is running, so the
countdown advances whenever the app is still in touch with the game at all — not only while combat
frames are streaming. It freezes, and reports itself as not advancing, only when the read path
itself is down (the hook has gone silent, or the app was never attached); a paused combat stream
with everything else still reachable is not treated as a loss of contact.
