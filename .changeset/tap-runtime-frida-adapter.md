---
"@bombfarm/tap-runtime": minor
"@bombfarm/desktop": patch
---

Add the `@bombfarm/tap-runtime` package: a Frida-backed implementation of the desktop app's
process-instrumentation port. Until now `@bombfarm/tap-runtime` was named as the live tap's
runtime dependency but never actually existed, so every attach attempt failed immediately and the
live tap could never come up.

The port's `attach()` is now asynchronous, matching Frida's own async attach/script lifecycle. The
agent script that runs inside the target process (`agent.js`) moves into the new package unchanged
and is embedded as a string at build time, alongside a small bridge that maps Frida's native hook
and messaging primitives onto the same host contract the agent already expects.

`frida` is a regular dependency now, kept external from the esbuild bundle and unpacked from the
packaged app's asar archive so its native addon can load.
