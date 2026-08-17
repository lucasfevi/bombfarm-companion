---
"@bombfarm/web": patch
---

Refreshes the bundled item art so every catalog item renders its icon again, and adds a guard
test so the next re-key cannot ship blank frames unnoticed.

The 2026-08-15 patch re-keyed item sets to new native levels and the catalog was regenerated, but
`apps/web/public/wiki-assets/items/` was not. `itemIconSrc` builds its path from the set's
**native** level, so 168 of the 240 wanted filenames had no bundled file — those items rendered an
empty rarity frame with no build error and no runtime error — while 144 files under the old keys
were left behind as dead weight in the static export.

- **168 item PNGs added, 144 stale ones removed.** The directory is now an exact bijection with
  the catalog: 240 defs, 240 files, nothing missing and nothing orphaned.
- **A new guard** in the `bundled wiki assets` suite resolves every `catalog.defs[].id` through
  `itemIconSrc` and asserts the file exists on disk, then asserts the reverse — that no bundled
  file is unreachable from the catalog. Both directions fail loudly the next time a patch re-keys
  the sets, whether the bundle is behind or ahead.

Also bundles the 18 field-prop sprites (ores, crystals, cages, boss, bomb) under
`public/wiki-assets/env/`. Nothing renders them yet; they are staged here so the art and the code
that will use it do not have to land in the same change.
