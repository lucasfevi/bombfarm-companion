---
"@bombfarm/desktop": patch
"@bombfarm/game-api": patch
---

Stop the desktop app from silently giving up on reading your account, and say how old the Farm
board's numbers really are.

**A single rejected read no longer freezes the app until you restart it.** When the game's servers
turned down one request, the app stopped asking — permanently. Everything carried on looking
normal: the Farm board kept its numbers, the Refresh button kept working, nothing said anything
was wrong. But the account behind those numbers had stopped moving, and the only way out was
quitting and reopening the app. One installation sat like that for over fifteen hours, and the
credentials had been fine the whole time — reopening the app proved it by working immediately with
the very same session. The app now waits and tries again, backing off from a minute up to fifteen
if the rejections keep coming, so a passing refusal costs one skipped read instead of the rest of
the session.

**The line under the Farm board's Refresh button now dates your account, not the calculation.**
It used to time how long ago the board was worked out, which is a different thing and only looks
the same while the app is reading the game normally. Change a setting on the board while the app
has lost contact and the line reset itself to "just now" over numbers that had not moved in hours.
It reports the age of the account read itself now — the oldest part of it, so it never sounds
fresher than the stalest thing under it — and no amount of recalculating can make that read look
newer than it is.
