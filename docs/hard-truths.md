# Proposing new hard truths

**Status:** process (meta hard truth)

Hard truths live under [`docs/`](README.md) (shared) and [`apps/web/docs/`](../apps/web/docs/README.md) (web-only). They are **current** durable rules.

## External delivery notes are never truth

PRDs, feature specs, task lists, validations, and wave write-ups may exist outside this repository as historical delivery evidence. They are **not**:

- current product truth
- a hard truth
- something agents should prefer over `docs/` or application source

On conflict, **`docs/` and code win**. Do not “fix” product behavior to match an old delivery note. Promote durable rules into `docs/` via the process below — never leave “the real rule” only in an external archive. Do not invent planning/spec directory trees in this repo.

## When to suggest one

While specifying, designing, implementing, or validating a feature, suggest a new hard truth when:

1. The same rule would apply to **future unrelated features**, not just this delivery.
2. Violating it would cause a **recurring bug**, visual regression class, or agent mistake.
3. It is **current truth** (not a temporary task, not a one-off exception with an exit date).
4. It is short enough to enforce (checklistable WHEN/THEN or numbered rules).

Good **seed** sources (historical only until promoted): repeated architecture notes, confirmed lessons, residual risks that never go away, “do not undo” outcomes.

## How to propose (do not silently promote)

1. **Draft** a short candidate: title, 3–10 rules, why durable, source (feature slug / note id).
2. **Ask the user** to accept, revise, or decline.
3. On accept: add `docs/<slug>.md` (or `apps/web/docs/<slug>.md` if web-only), link it from the matching docs README and [`AGENTS.md`](../AGENTS.md), and (if Cursor should auto-apply) add a thin `.cursor/rules/<slug>.mdc` stub that points at the doc.

Temporary CSS exceptions with exit criteria live in [`css-exceptions.md`](css-exceptions.md). When a temporary family is fully migrated (or reclassified permanent), update that doc — do not leave a second competing exception list elsewhere.
