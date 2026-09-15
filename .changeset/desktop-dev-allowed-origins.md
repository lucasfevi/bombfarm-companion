---
"@bombfarm/desktop": patch
---

Stop `pnpm dev` printing Next's "Cross origin request detected from 127.0.0.1" warning on every
renderer asset request. The dev script points Electron at `127.0.0.1` while `next dev` identifies
itself as `localhost`; the renderer's Next config now lists `127.0.0.1` as an allowed dev origin.
Dev-only — packaged builds load the static export and never ran a dev server.
