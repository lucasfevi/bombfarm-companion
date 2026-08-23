---
"@bombfarm/desktop": patch
---

Fix a packaged build failing to boot with `game-data fixtures directory not found`. `GameReaderService` loaded its dev/CI-only fixture bundle eagerly in a field initializer, so every instantiation resolved fixture paths regardless of read mode — paths that only exist in the monorepo source tree, never in an installed app. The fixture bundle is now loaded lazily, only when fixture mode actually needs it, so a normal (memory-mode) run never touches the filesystem for it.

Fix a second, independent boot failure: an installed app launched from the Start menu could try to load the development server (`http://127.0.0.1:3000`) instead of its bundled renderer, failing with `ERR_CONNECTION_REFUSED`. Dev-mode detection relied solely on an environment variable that a packaged install never sets, so its absence was silently read as "development". It now also requires the app to be unpackaged, so a packaged install can never fall into dev mode just because that variable is unset.
