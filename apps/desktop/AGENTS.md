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

Two guards will tell you, and neither one can see a rearrangement:

```bash
npx vitest run --project tools download-page-drift
```

- Renaming or rewording a `live*` label in `renderer/lib/copy/` fails the label mirror.
- Adding, removing, or renaming a file in `renderer/app/live/` fails the component pin.

When the pin fails, **update the replica first and re-pin `LIVE_COMPONENTS` second, in one commit**
— re-pinning on its own turns the guard green over a drawing nobody looked at. The full rule, and
what the guards deliberately do not cover, is in [`apps/web/AGENTS.md`](../web/AGENTS.md).

## Local checks

```bash
pnpm --filter @bombfarm/desktop typecheck
pnpm test:smoke
```
