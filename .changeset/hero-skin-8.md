---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Adds the 8th cosmetic hero appearance so a hero saved with `skin: 7` stops rendering someone
else's face, refreshes all 8 avatars from the wiki, and adds a guard test so the next new
appearance cannot go missing unnoticed.

The game ships 8 cosmetic appearances, but `HERO_SKIN_COUNT` was 7 and `SKIN_AVATAR_FILE` had
only seven entries. `heroAvatarSrc` indexes that array and falls back to `?? 1`, so skin 7 fell
off the end and resolved to `hero1_avatar.png` — every hero wearing the 8th appearance rendered
**skin 1's face**. That is the bad failure mode: not a broken image or a blank frame that someone
would notice and report, but confidently wrong art that looks fine. Import was affected the same
way, since `isKnownSkin` shares the bound: a save carrying `skin: 7` was treated as out of range
and reset to the neutral placeholder `0`, discarding the real value on disk.

- **`HERO_SKIN_COUNT` is now 8** and `SKIN_AVATAR_FILE` maps skin 7 to `hero8_avatar.png`. The
  existing `hero2`/`hero3` swap against in-game skins 1/2 is unchanged. Skin 7 → file 8 is
  inferred from the identity mapping that holds for indices 3..6; it is noted in the source as
  not yet confirmed against an in-game save carrying `skin: 7`.
- **All 8 avatars are re-bundled from the wiki at its current 192x192.** Skins 0–6 were
  previously bundled at 256x256; dropping them to 192x192 is deliberate, so the whole set is one
  internally consistent mirror of the wiki's current art rather than a mix of two vintages. The
  characters are unchanged — every filename still holds the same face, so no stored `skin` value
  changes meaning.
- **A new guard** in the `bundled wiki assets` suite resolves every skin index `0..N-1` through
  `heroAvatarSrc` and asserts the file exists, then asserts the reverse — that no bundled
  `hero{N}_avatar.png` is unreachable from a skin index — and that no two indices resolve to the
  same file, which is the `?? 1` fallback's signature. This is the check that would have caught
  the missing 8th appearance.

The free/premium split of the 8 appearances is not surfaced anywhere in the UI; this change is
art and indexing only.
