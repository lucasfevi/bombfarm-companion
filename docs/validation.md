# Validation (author ≠ validator)

**Status:** hard truth

The agent that **implements** (or fixes) a change must not be the one that **validates** it.

## Rules

1. After implementing or fixing, dispatch a **fresh validator subagent** — do not self-check and declare the work done.
2. The validator does not inherit the author's context, assumptions, or mental model. Give it: change surface (diff / files), the acceptance checklist for **this** delivery (often ACs from the private planning workspace while a wave is open), and local-check commands. Treat planning ACs as **historical / delivery evidence**, not living product truth — if an AC conflicts with [`docs/`](README.md) or shipped code, **`docs/` and code win**; note the drift instead of “fixing” code to an outdated spec.
3. The validator reports **PASS/FAIL with evidence** and does **not** fix code.
4. Gaps go back to an implementer; then re-dispatch the validator. Cap fix→re-verify at **3 rounds**, then escalate to the user.
5. Spec-driven features: file the validator’s report in the **private planning workspace** (not this repo) as delivery evidence.
6. Multi-feature orchestrated deliveries: also file a wave review in that private archive — still historical once filed.
7. Prefer evidence-or-zero against acceptance criteria; do not weaken, skip, or delete tests to make gates pass.

## Local checks (before calling PASS)

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For **UI / styling / visual** waves (or any change that can shift layout, tokens, or client flows), also run:

```bash
pnpm test:e2e
```

For **Storybook / design-system catalog** waves, also run:

```bash
pnpm build-storybook
```

Keep `pnpm test` as the fast Vitest unit gate — do not fold Playwright or Storybook into it. See [`e2e-visual.md`](../apps/web/docs/e2e-visual.md) for the Docker e2e workflow (matches CI on any host), baselines, and **review-before-update**; [`design-system.md`](design-system.md) for the Storybook catalog.
