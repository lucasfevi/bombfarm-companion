# Renderer Content-Security-Policy

The packaged desktop app serves its renderer from `app://bundle/` through `protocol.handle`
(`apps/desktop/src/main/renderer-protocol.ts`). Every response from that handler carries a
`Content-Security-Policy` header. `pnpm dev` and `pnpm dev:offline` load the Next dev server
instead, which does not pass through the handler, so **the policy applies to the built app only**
— the dev server needs `eval` and an inline HMR runtime that the policy exists to forbid.

## The policy

An HTML page gets (`documentPolicy` in `apps/desktop/src/main/renderer-csp.ts`):

| Directive | Value | Why |
| --- | --- | --- |
| `default-src` | `'none'` | Anything not named below is forbidden. |
| `script-src` | `'self'` + the page's inline-script hashes | No `'unsafe-inline'`, no `'unsafe-eval'`. Next's static export inlines `self.__next_f.push(…)` bootstrap scripts whose text differs per page; each is allowed by its SHA-256 and nothing else is. |
| `worker-src` | `'self'` | The Optimizer's search runs in a worker whose script is a chunk of the bundle. `blob:` and `data:` workers stay refused. |
| `style-src` | `'self'` + hashes of `<style>` elements | Stylesheets are files in the bundle. Base UI would inject a `<style>` of its own at runtime (scroll areas, the Select list); the root layout turns that off with `CSPProvider disableStyleElements` and `globals.css` carries the one rule. |
| `style-src-attr` | `'unsafe-hashes'` + hashes of the page's `style="…"` values, or `'none'` | The export prerenders a few inline `style` attributes (the window drag region, the header gutter). They are hashed one by one. React's runtime style updates go through the CSSOM, which CSP does not govern. |
| `img-src` | `'self' data:` | Game art is bundled. `data:` covers the share card (html-to-image builds an SVG data URL) and the CSS-masked checkbox glyph. No `blob:`. |
| `font-src` | `'self'` | Fonts are bundled. |
| `connect-src` | `'self'` | The renderer reaches the network only through IPC; the main process makes every API, update and market request. `'self'` is for html-to-image reading the bundle's own fonts and images. |
| `object-src`, `form-action`, `frame-src`, `frame-ancestors` | `'none'` | Nothing embeds, plugs in or posts. |
| `base-uri` | `'self'` | html-to-image resolves each url it inlines by setting a `<base>` in a scratch document that inherits this policy; under `'none'` the share card loses its fonts and images. A `<base>` can still only point back into the bundle. |

`'self'` is checked against `app://bundle` by Chromium for this registered standard scheme; the
smoke suite would fail on the first window if it were not.

Every non-HTML response gets `default-src 'none'; script-src 'self'; base-uri 'none';
form-action 'none'; frame-ancestors 'none'` and `X-Content-Type-Options: nosniff`. The header on
a script matters: a worker takes its policy from the response that delivered it, not from the page
that started it, so an unheadered chunk would run as a worker with no policy at all.

A hash allows any inline script with that exact text, however it reaches the DOM. The lists are
per page so that one page's scripts do not run on another.

## Bound to the build

`pnpm build:renderer` runs `next build` and then `scripts/write-csp-manifest.mjs`, which scans
every `renderer/out/**/*.html` and writes `renderer/out/csp-manifest.json`: per page, the SHA-256
of each inline script, `<style>` element and `style` attribute value. It then re-derives the
hashes from the files on disk and compares, in both directions.

The build fails when:

- a page has an inline event handler (`onclick=…`) or a `javascript:` URL — a policy that allowed
  those would need `'unsafe-hashes'` for scripts, which is the hole;
- a page holds a construct the scanner does not model (CDATA, a script inside `<svg>`, `<!--`
  inside a script, an unterminated tag, `<iframe>`, `<object>`) — it refuses rather than guesses;
- the manifest lists a hash that matches nothing, or a page has an inline script the manifest does
  not hash, or a page is missing from the manifest.

The packaging gate (`scripts/package-gate.mjs`) repeats the comparison on the pages and manifest
**inside the packaged `app.asar`**. The main process reads the manifest at startup and refuses to
boot without it; every hash is validated against `sha256-<base64>` before it is placed in a
header, so a hand-edited manifest cannot add a directive.

An HTML file the manifest does not list is served with `script-src 'self'` alone.

## Adding something the policy forbids

Prefer not to. A new origin for the renderer means a new directive source and a line in this
table; route the request through the main process first. The manifest only hashes what the export
contains, so a `<style>` or `<script>` a component injects at runtime is refused, and the smoke
suite fails on the screen that mounts it. That is how Base UI's scroll-area style was found: the
fix was to switch the injection off and ship its rule in `globals.css`, not to allow
`'unsafe-inline'`. A screen the smoke suite never opens can still hold such a component.

## Tests

- `scripts/csp-manifest.test.mjs`, `src/main/renderer-csp.test.ts`, `src/main/renderer-protocol.test.ts`
  — scanner, hashes, policy text and the header on each kind of response.
- `tests/smoke/csp.spec.mjs` — inside real Electron, in the main and the mini-live window: inline
  script, `eval`, `new Function`, string timers, `javascript:` links, inline handlers, `data:` and
  `blob:` scripts, and a script, stylesheet, image, font, fetch, socket, beacon, frame, form and
  `<base>` pointed at a foreign origin must all fail, naming the directive that stopped them.
- `tests/smoke/smoke-test.mjs` — every smoke spec launches Electron through it. A
  `securitypolicyviolation` event or a CSP console error in any window fails the test that was
  running, and anything left over fails the worker. `scripts/smoke-csp-guard.test.mjs` keeps a new
  spec from launching around it.
- Workers are watched over CDP (`tests/smoke/csp-guard.mjs`), because Playwright's worker console
  carries only `console.*` calls: dedicated workers by auto-attach (held until `Log` and `Runtime`
  are on), shared workers by target discovery and `Target.attachToTarget`, with the replay
  `Log.enable` gives for what they logged first. A refused `eval` in a worker writes no log
  entry, only an uncaught exception, so exceptions are read too. `csp.spec.mjs` runs a probe
  worker of each kind that fetches a foreign origin and evals. A service worker is not watched or
  probed: the app registers none.
