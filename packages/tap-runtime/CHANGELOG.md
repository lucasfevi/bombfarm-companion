# @bombfarm/tap-runtime

## 0.2.1

### Patch Changes

- f8f6832: Stopping the tap now waits for the read hook to actually be removed

  Withdrawing consent stops the tap before the withdrawal is recorded. That stop was only ever
  _started_, though: detaching a session kicked off the script unload and returned immediately, so
  the app recorded the revoke and told the player the tap had stopped while the injected read hook
  was still resident and could still deliver a frame.

  Detaching now returns a promise that settles once the unload and the underlying detach have both
  finished, and the tap waits for it. Because that wait crosses into the instrumented process, it is
  bounded: a runtime that does not answer within a couple of seconds is abandoned with a log record
  rather than holding the settings screen open indefinitely. The guarantee is now the one the code
  claims, and the one case where it cannot be kept says so out loud.

## 0.2.0

### Minor Changes

- 4cd94f9: Add the `@bombfarm/tap-runtime` package: a Frida-backed implementation of the desktop app's
  process-instrumentation port. Until now `@bombfarm/tap-runtime` was named as the live tap's
  runtime dependency but never actually existed, so every attach attempt failed immediately and the
  live tap could never come up.

  The port's `attach()` is now asynchronous, matching Frida's own async attach/script lifecycle. The
  agent script that runs inside the target process (`agent.js`) moves into the new package unchanged
  and is embedded as a string at build time, alongside a small bridge that maps Frida's native hook
  and messaging primitives onto the same host contract the agent already expects.

  `frida` is a regular dependency now, kept external from the esbuild bundle and unpacked from the
  packaged app's asar archive so its native addon can load.
