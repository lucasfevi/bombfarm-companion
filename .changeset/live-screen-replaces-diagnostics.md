---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/domain": minor
---

The desktop app now opens on a Live screen showing what your account is doing right now, instead
of the Planning screen you had to navigate away from to see anything current.

The screen shows four hero lists — on field, recovering, queued, benched — the active house (its
level, slots, cycle time, and how many daily rescues are left), and field occupancy as plain
information (heroes on field against the field size, with no warning styling and no implication
that an open slot is a mistake). Every list renders even when it has nothing in it, with a line
explaining why, because a hidden empty list and a missing section would look identical and
"nobody is currently recovering" is real information worth showing. A hero whose name has not
synced yet still renders, by its id.

A status line at the top says whether the screen is reading live frames from the game or falling
back to the slower authenticated read, and if it is not live, says why in plain language — the
game is open but idle, the app has not connected yet this session, security software is the likely
reason the connection failed, and so on. The one case with a real fix (you have not allowed the
app to read your account) offers a control to review that permission again; every other case is
already retried automatically every few seconds, so the screen does not offer a button that would
not do anything.

Three honesty properties carry through the whole screen. A value the game never sent renders as a
visible gap, never as a substituted zero, dash, or "Unknown" — and a value that is genuinely zero
still renders as zero, so the two read differently on screen. A hero's remaining field time is
either measured from observed frames or estimated from stats, and an estimate is marked with a
muted, non-layout-shifting treatment (plus a screen-reader-only label) so it can never be mistaken
for a measurement, even as the game's own reporting flips between the two while you watch. A
recovery countdown that has stopped advancing is shown as paused rather than left to look like it
is still ticking down on its own.

Every string on the new screen ships in Brazilian Portuguese as well as English, matching the rest
of the app.

The developer-only Diagnostics tab and its raw-payload dump are removed, along with the two
internal channels that fed them. This is a deliberate loss with no replacement in this change — the
Settings screen's own "save a bug report file" control is a different feature and is unaffected.

Field occupancy now counts a hero the live frames show on the field even before the slower account
read has caught up to it, so "slots in use" never reads lower than what is genuinely deployed. A
hero walking off the field is reported with its own calm, self-resolving line rather than the
message reserved for data the app genuinely could not read.

The screen also keeps up with the game far better than a polling app could. While you play, the
game client is constantly fetching your own account state from its server, and the companion is
already reading that same traffic — so it now recognises those responses and updates from them
directly, instead of asking the server again for something it just watched arrive. Benching a
hero, or sending one out to the field, shows up in the companion without waiting out a refresh
cycle, and without adding a single request of its own.

This is opportunistic by nature: it only learns what your game actually asks for, so the
companion's own paced reads remain in place for everything else — before the game has fetched a
route for the first time, and whenever you leave the app open without playing. A response the
companion cannot confidently recognise, which is what a game update looks like from here, is
discarded rather than guessed at, and the app falls back to reading for itself.

A hero's remaining field time now counts steadily down instead of leaping up and down as heroes
rotate on and off the field. When the app cannot measure a hero's drain directly it estimates it —
but that estimate was never given the hero's own drain-reduction data, so it assumed no reduction
at all and ran up to 40% out. It now uses each hero's real abilities and the field's actual aura.
The app also stops discarding a hero's measurements every time some unrelated hero steps on or off
the field, and only does so when that hero's own drain conditions genuinely change. Where no rate
can be measured or estimated at all, no countdown is shown rather than one built from a number
known to be wrong.
