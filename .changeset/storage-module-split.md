---
"@bombfarm/web": patch
---

Splits the localStorage read/write primitives and the one-shot flat-crit-damage roster migration
out of `storage.ts` into `storage-json.ts` and `storage-critdmg-migration.ts`. `storage.ts`
re-exports the primitives, so `@/shared/lib/storage` remains the single import site and no calling
code changes. Pure module reorganisation — no behaviour change.
