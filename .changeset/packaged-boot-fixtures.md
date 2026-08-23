---
"@bombfarm/desktop": patch
---

Fix a packaged build failing to boot with `game-data fixtures directory not found`. `GameReaderService` loaded its dev/CI-only fixture bundle eagerly in a field initializer, so every instantiation resolved fixture paths regardless of read mode — paths that only exist in the monorepo source tree, never in an installed app. The fixture bundle is now loaded lazily, only when fixture mode actually needs it, so a normal (memory-mode) run never touches the filesystem for it.
