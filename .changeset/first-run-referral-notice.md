---
"@bombfarm/web": patch
---

Explain the referral code once, on the first visit, instead of only showing it.

The code was already in the topbar and the footer, but neither surface has room to say what a player is supposed to do with it. A code with no explanation is a string of characters next to a copy button.

A notice now appears once below the topbar, on whichever page the first visit lands on: paste the code on the game's invite screen, each account uses one referral code, and once you clear stage 151 both sides get a reward that includes at least one Hero Cage. It carries the code with a copy button of its own and a dismiss button, and it does not come back — copying counts as dismissing, so the usual path closes it in one click. A failed clipboard write leaves the code selected for a manual copy and keeps the notice open, since removing it would take the selection with it.

The notice is half the app's width and centered, with both controls on a row of their own beneath the text, so it reads as a notice rather than a second header bar.
