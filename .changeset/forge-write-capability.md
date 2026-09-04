---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/game-api": minor
---

Give the app the ability to make one kind of write — a forge roll — behind a switch that is off.

**The companion can now send one thing.** Until now it was read-only by construction, and the
guards that prove it stayed green on every change. It can now make exactly two calls of its own,
the two the game's own forge screen makes when you roll an item: `/item/forge` and
`/item/forge_to_safe`. Nothing else in it can write. The guards still prove that: `POST` is
allowed in one file, that file names those two paths and no other, and every other file is held
to the same no-write rule as before. A write also has to come from a session that was granted
consent, and from a write capability that only exists while the switch below is on — both are
checked at runtime, not only by type. Writes share the reads' pacing gate, so a cooldown on a roll
backs off the account reads too, and no two calls of any kind can interleave past each other.

**The disclosure changed, so everyone will be asked again.** The first-run text used to say
"never writes". It now says what the app can send, that it can only do so from the Forge tab,
only after you turn the switch on, and only after you confirm each run. Every install sees the
new text at its next launch and has to allow it again.

**The switch is off until you turn it on.** Settings has a new Forge section with one control,
"Let Forge spend gold". Off, the Forge tab plans climbs and never rolls. On, the Forge button can
spend gold on your account, one confirmed run at a time. An existing install migrates with it off.

**The tab itself comes in a later change.** This is the boundary work: the capability, the
disclosure, the switch. Nothing in the app calls the new write yet.
