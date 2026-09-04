---
"@bombfarm/desktop": patch
---

Recover on their own from a failed hook discovery, and say in the log why one failed.

A single empty candidate scan used to retire the game process permanently: the pid was latched and
every later poll returned "could not connect to the game" without rescanning, so one unlucky
moment — an image read starved of memory, a security product mid-sweep, a game launched elevated —
left the app reporting a connection failure every five seconds until it was quit and reopened. The
whole account went with it, because the authenticated read is gated on the live reader being
connected even though it needs nothing from it. A player who restarted the app saw it start
working and had no way to know why.

Discovery now stands down on a ladder (15s, 1m, 5m, 15m) and rescans, so a transient failure
recovers without a restart while a binary that genuinely cannot be hooked is not rescanned on a
loop. It also records the build it scanned and that it has not given up, and the image read — which
used to resolve every failure to the same bare "nothing found" — now names which step failed: no
executable path (what Windows answers for an elevated process), or a read the filesystem refused.

The scan also stops reading the whole file. A single-file game export carries its content pack as a
trailing section, so the scan was reading 830 MB synchronously on the main process to look at the
first 104 MB of it. Bounding the read to the sections the scan actually uses finds the identical
hook address from 12.5% of the bytes, in 26ms instead of 204ms, holding 380 MB instead of 1058 MB.
