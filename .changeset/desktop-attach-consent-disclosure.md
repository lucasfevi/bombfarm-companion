---
"@bombfarm/contracts": minor
"@bombfarm/game-api": minor
"@bombfarm/desktop": minor
---

The first-run consent dialog now discloses that the desktop companion attaches to the running
Bomb Farm client to read the traffic it is already exchanging with the game's server, in addition
to calling the game's own API with the session token the game already saves on your machine. The
dialog also explains that this attaching technique is what can cause antivirus software to flag or
quarantine the companion, and that the warning is about the technique, not a virus.

Because the disclosure changed, everyone who already accepted the previous version is asked to
review and accept the new one before the companion reads their account again.

A new Account access control in Settings makes the disclosure's "reversible" promise real: turning
access off stops the reads and detaches from the game client immediately, and turning it back on
re-shows the same disclosure so the player reviews it again before allowing.

The dialog is now shown in Portuguese as well as English, and the recorded decision remembers which
language it was shown in, so an agreement is always traceable to the exact wording the player read.

The desktop app no longer runs without this permission. Declining now shows a screen explaining
that the companion has nothing to show without account access, with a control to read the
disclosure again and accept. That screen carries its own language switch, so a player whose
computer language does not match the language they read can still understand what they are
agreeing to.
