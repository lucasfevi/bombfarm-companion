# Agent guide — `@bombfarm/desktop`

Thin index for the Electron shell. Shared monorepo rules: root [`AGENTS.md`](../../AGENTS.md) + [`docs/`](../../docs/README.md).

## RULE: the Live screen is drawn a second time on the website

The web app's download page (`apps/web/src/features/download/components/live/live-replica.tsx`) shows a
replica of **this app's Live tab** to people deciding whether to install it. It shares no code with
`renderer/app/live/` — the web app's boundaries forbid importing from here, and this shell speaks
its own bilingual copy layer ([`docs/i18n.md`](../../docs/i18n.md)) — so it is a hand-drawn copy of
a screen you are about to change.

**Changing the Live screen means changing the replica in the same PR.** A panel added, removed,
reordered, relabelled, or a figure whose meaning moved: the drawing has to follow, or the site
advertises a screen the app no longer has.

Three guards will tell you, and none of them can see a rearrangement:

```bash
npx vitest run --project tools download-page-drift
```

- Renaming or rewording a `live*` or `miniLive*` label in `renderer/lib/copy/` fails the label
  mirror.
- Adding, removing, or renaming a file in `renderer/app/live/` fails the component pin.
- Adding, removing, or renaming a file in `renderer/app/mini-live/` fails the compact-window pin.

When a pin fails, **update the drawing first and re-pin `LIVE_COMPONENTS` / `MINI_LIVE_COMPONENTS`
second, in one commit** — re-pinning on its own turns the guard green over a drawing nobody looked
at. The full rule, and what the guards deliberately do not cover, is in
[`apps/web/AGENTS.md`](../web/AGENTS.md).

## RULE: the compact Live window is a third drawing of the same panels

`renderer/app/mini-live/` is the second Live window — earnings, map and heroes redrawn at a
smaller size. It shares the copy keys, the countdowns, the energy bar and the state summary with
`renderer/app/live/`, so relabels and shared parts follow on their own, but the figures each panel
prints and the order they come in are a hand copy with no guard behind them. Its hero row is its
own: a fixed-height two-line grid marking state by shape, where the full-size row is one line
marking energy direction by caret.
**A figure added, dropped, or re-meant in a Live panel is checked against its `mini-*` twin in
the same PR.** `page.test.tsx` there pins what the window may not import (no app shell, no
consent gate, no other tabs) and the layout it defaults to.

The website draws this window too, as an interactive section of the download page
(`apps/web/src/features/download/components/mini-live/`), so a change here has a third drawing to
follow — see the rule above and [`apps/web/AGENTS.md`](../web/AGENTS.md).

## RULE: the renderer runs under a strict Content-Security-Policy built from the export

Every response from the `app://` handler carries a policy with no `'unsafe-inline'` and no
`'unsafe-eval'`; inline scripts, `<style>` elements and `style` attributes are allowed by SHA-256,
from a manifest `pnpm build:renderer` writes beside the pages. Inline event handlers, `javascript:`
URLs and anything the scanner does not model fail the build. **A new renderer dependency that
injects a `<style>`, evals, opens a worker from a `blob:`, or reaches a new origin will be refused
at runtime** — and every smoke spec fails on a violation, so you will see it. Route network
access through the main process instead of widening the policy. `pnpm dev` is not covered.
See [`docs/renderer-csp.md`](../../docs/renderer-csp.md).

New smoke specs import `test`, `expect` and `electron` from `tests/smoke/smoke-test.mjs`, never
from `@playwright/test`; a guard fails otherwise.

## RULE: the preload runs in the renderer sandbox

Both windows are built from `sandboxedWebPreferences` (`src/main/web-preferences.ts`), and
`app.enableSandbox()` covers any window added later. A sandboxed preload can `require` only
`electron`, `events`, `timers` and `url`, so everything else it imports (`electron-log/renderer`
included) is bundled into `dist/preload/index.cjs` by `scripts/electron-bundles.mjs`, and anything
that needs Node, a file or a native module belongs in the main process behind IPC. Importing
`node:fs` or similar into the preload fails `scripts/preload-bundle.test.mjs`, not the user's launch.

## RULE: every `bfc:invoke` is checked against its sender, and the compact window has an allowlist

`src/main/ipc-sender-policy.ts` decides, before any handler runs, whether a call may proceed: the
sender frame must be live, the top-level frame of its window, in a window the app owns, at the
app's own origin (plus the dev renderer origin when unpackaged and in dev mode). The compact Live
window is further held to `MINI_LIVE_INVOKE_CHANNELS`.

**A new `invoke('…')` call in `renderer/app/mini-live/` or anything it imports needs its channel added
to that set**, or the call is refused at runtime; `mini-live-channel-allowlist.test.ts` fails first and
names the difference. It also fails if a channel is allowed that the window no longer calls, so the
set stays exactly what the window needs. A new `ipcMain` listener of our own owes the same sender
check: `ipc-listeners-guard.test.ts` reads the AST and fails on any `ipcMain`/`webContents.ipc`
registration whose channel is not a string literal, on an aliased or destructured `ipcMain`, and on
any registration beyond the one `bfc:invoke` handler built by `createBridgeInvokeHandler`.

**Never embed a same-origin frame (`srcdoc`, `about:blank`, `app://`) in a window that has the
bridge.** The sender check cannot tell such a child from the top frame: `window.top.bfc.invoke`
runs in the top frame's context, so `senderFrame` is the top frame. A CSP `frame-src` does not close
this (`srcdoc` and `about:blank` children still load). What does: give untrusted content an opaque
origin (a sandboxed iframe without `allow-same-origin`) or its own window or partition that has no
preload.

## RULE: a page cannot take its window anywhere else, and only a link or the app itself opens the browser

`src/main/external-navigation.ts` refuses every top-level navigation away from the app's own origin
(`will-navigate`, which a `<meta http-equiv="refresh">` or a `location` assignment reaches with no
script a CSP could stop), every redirect off it (`will-redirect`), and every subframe navigation to
anything but the app origin or an empty document (`will-frame-navigate`). None of them hands
anything to `shell.openExternal`.

Chromium commits a page's own navigation to `about:blank` or `about:srcdoc` without raising any of
those events, whoever started it (a removed child frame leaves no initiating frame at all). So the
policy checks where the window *is*, not how it got there: on `did-navigate`, `did-stop-loading`,
`did-finish-load` and `did-fail-load`, a main frame that is off the app origin is sent back to the
entry page the window was created with. The one exemption is a page the main process loaded on
purpose: the policy wraps the window's `loadURL`, and a page that load settled on is trusted until
the window leaves it. Never call the original `loadURL` around the wrapper. Recovery is limited to 3
per 10 s per window; past that it logs `navigation.recovery_stopped` once and leaves the window
blank (the user restarts the app), so a page that always sends its window back to a blank cannot
burn CPU. Calling `loadURL` from inside a navigation event crashes the app, hence the deferred
load.

The ways a link reaches the browser are `target="_blank"` / `window.open` (the window-open handler,
`https:` only; a script-driven `window.open` included, which a packaged run's CSP blocks) and a
main-process call such as the Premium sign-in. **A new external link in the renderer must be
`target="_blank"`**; a plain anchor is refused, and the smoke spec for this lists every link the UI
shows.

`src/main/session-permissions.ts` answers every permission request and check, and cancels every
HID, USB, serial and Bluetooth device selection. `GRANTED_PERMISSIONS` is the allowlist, pinned to
its exact contents by a test, and it is only ever granted to the app's own origin. It holds one
entry today: `clipboard-sanitized-write`, which copying the referral code needs. **A feature that
needs a permission adds one line there, updates that pin, and adds a smoke assertion that the
feature works.** The File System Access pickers never reach a permission handler, so
`index.ts` switches that API off at startup instead; the renderer does not use it.

Both are wired in `index.ts` (`installSessionSecurity`, `windowNavigationPolicy`), and
`window-security-wiring-guard.test.ts` reads that file's syntax tree so a commented-out, conditional
or emptied call fails a test, and so does a local binding, parameter or reassignment that replaces
`installSessionSecurity` or `createNavigationPolicyApplier` with something other than the module's
own export.

## Local checks

```bash
pnpm --filter @bombfarm/desktop typecheck
pnpm test:smoke:hidden
```

**Agents always use `test:smoke:hidden` — never the visible `test:smoke`, and never a visible
Electron window for screenshots** (hard rule, see the root [`AGENTS.md`](../../AGENTS.md)).
`pnpm test:smoke:hidden` runs the same specs without any window reaching the screen, so a run does
not paint over what you were doing or take focus a dozen times. Electron has no headless mode and
Playwright's `_electron.launch` has no `headless` option; this instead sets `BFC_HIDE_WINDOWS=1`,
which suppresses the reveal a window does when it is created. The renderer still lays out and still
animates, so nothing the specs measure changes — but explicit `show()` calls are deliberately
untouched, so `tray-hide.spec.mjs` still surfaces a window when it exercises the tray's Show, which
is the behaviour it exists to prove. The flag is unpackaged-only and CI keeps running the visible
form, which is what covers the reveal path itself.

**It buys quiet, not speed: the same 43 specs take 52 s visible and 4.4 min hidden.** The cost is a
flat ~2 s per launch plus a much steeper penalty on the specs that resize the window (one goes
0.96 s → 11.6 s). `backgroundThrottling: false` was measured and changes nothing, so the cause is
not timer throttling — do not reach for it again. Reach for the hidden run when you want your
machine back, not when you want a fast loop.
