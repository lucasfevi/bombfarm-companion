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

## Local checks

```bash
pnpm --filter @bombfarm/desktop typecheck
pnpm test:smoke
```
