---
"@bombfarm/web": patch
---

Split `apps/web/src/shared/lib/storage.ts` — which had sat at its file-specific `max-lines` allowlist cap (354) with zero slack after four straight waves of bumping it instead of splitting — into `storage.ts` (hero-record persistence: `HeroRecord`, `loadHeroes`/`saveHeroes`/`upsertHero`/`importHeroes`/`deleteHero`, the localStorage read/write helpers) and a new `shared/lib/account-shared.ts` (the `AccountShared` concern: `TreeState`/`HeroContext`/`AccountShared` types, their `DEFAULT_*` factories, and their load-time normalizers). No behaviour change — every symbol `storage.ts` exported before is re-exported from the same path, and the storage test suite (including the `storage-roundtrip-20260729.json` byte-identity fixture) passes unmodified. The file-specific `max-lines` allowlist entry for `storage.ts` is removed; it now lives under the shared-lib default cap (300) with no bump.
