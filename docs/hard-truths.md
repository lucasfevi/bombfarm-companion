# Proposing new hard truths

**Status:** process (meta hard truth)

Hard truths live under [`docs/`](README.md). They are **current** durable rules.

## `.specs/` is never truth

Everything under [`.specs/`](../.specs/README.md) (PRDs, feature specs, tasks, validations, waves, `STATE.md`, lessons) is a **historical delivery archive**. It may record how a decision was made or what a wave intended at ship time. It is **not**:

- current product truth
- a hard truth
- something agents should prefer over `docs/` or application source

On conflict, **`docs/` and code win**. Do not “fix” product behavior to match an old `.specs/` file. Promote durable rules into `docs/` via the process below — never leave “the real rule” only in `.specs/`.

## When to suggest one

While specifying, designing, implementing, or validating a feature, suggest a new hard truth when:

1. The same rule would apply to **future unrelated features**, not just this PRD/spec.
2. Violating it would cause a **recurring bug**, visual regression class, or agent mistake.
3. It is **current truth** (not a temporary task, not a one-off exception with an exit date).
4. It is short enough to enforce (checklistable WHEN/THEN or numbered rules).

Good **seed** sources (historical only until promoted): repeated STATE `AD-*` notes, confirmed lessons, wave residual risks that never go away, “do not undo” architecture outcomes.

## How to propose (do not silently promote)

1. **Draft** a short candidate: title, 3–10 rules, why durable, source (feature slug / AD-id / lesson id).
2. **Ask the user** to accept, revise, or decline — same bar as “validate with me first” for extractions from `.specs/`.
3. On accept: add `docs/<slug>.md`, link it from [`docs/README.md`](README.md) and [`AGENTS.md`](../AGENTS.md), and (if Cursor should auto-apply) add a thin `.cursor/rules/<slug>.mdc` stub that points at the doc.
4. Optionally note in `.specs/STATE.md` that AD-NNN was promoted to `docs/<slug>.md` (archive breadcrumb only).

## What stays in `.specs/` (archive)

| Keep in… | Why (historical) |
| --- | --- |
| `.specs/features/<slug>/` | Feature ACs, tasks, one-off validation evidence for that delivery |
| `.specs/prds/<slug>/` | Product intent as written for a workstream |
| `.specs/STATE.md` | Decision / handoff log; may seed a hard-truth proposal |
| `.specs/LESSONS.md` | Unconfirmed or single-feature signals; may seed a proposal |
| `.specs/waves/` | Wave closeout narrative |

Temporary CSS exceptions with exit criteria live in [`css-exceptions.md`](css-exceptions.md). When a temporary family is fully migrated (or reclassified permanent), update that doc — do not leave a second competing exception list in a closed feature folder.
