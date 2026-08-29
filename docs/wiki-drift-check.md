# Wiki drift check (MP5 F5)

**Status (2026-08-14):** the wiki is refreshed out of band by a maintainer; between refreshes the
committed artifacts derived from it (`packages/domain/src/data/phase-wiki.json`, `catalog.json`,
`phases.json`) can silently diverge from what the wiki now publishes, for an unbounded time. This
feature adds a scheduled detector for exactly that staleness.

## 1. The rule

**No wiki HTTP client in shipped app code** — not in `apps/**`, not in `packages/**`, not in the
Electron main process, the renderer, or the web bundle. The one sanctioned exception is a
scheduled CI job, [`.github/workflows/wiki-drift.yml`](../.github/workflows/wiki-drift.yml), which
is **alert-only** and **may not write `packages/domain/**`**. A guard enforces this — it is not
merely documented (`tools/wiki-drift-narrowed-rule.test.mjs`).

## 2. What the job does

Once a day (plus on-demand via `workflow_dispatch`), the job fetches the wiki's two published data
endpoints, computes a sha256 fingerprint per endpoint (whole-payload hash, a hash per top-level
section, the sorted list of section names, and the catalog version field), and compares that
fingerprint against a committed baseline
(`tools/wiki-drift/fingerprint.baseline.json`). Any difference — a changed section, an added
section, a removed section, or a catalog-version change — is **drift**. The run reaches one of
four outcomes and raises the alert on two independent channels: the job itself fails, and a single
tracking issue is opened or updated. Neither channel alone is the whole signal.

### `versao_catalogo` is not a change signal

The fingerprint records the catalog version, and a change in it is drift — but the converse does
not hold, and assuming it does will miss a patch. The 2026-08-28 damage patch restated 186 of the
240 item definitions and added three fields to `itens`, and `versao_catalogo` **stayed at 4**
through all of it. The section hashes caught it; the version field would not have.

So the version is one more field that can move, never a cheap pre-check that lets a run skip
hashing the sections. Nothing in this job treats it as one, and nothing downstream should either.

## 3. Accepting a drift

1. Confirm the change is real — check it in the live game, or on the wiki itself.
2. Refresh the committed companion artifacts (`phase-wiki.json`, `catalog.json`, `phases.json`)
   through the normal out-of-band wiki refresh process.
3. Run `node tools/wiki-drift/check.mjs --write` from a maintainer machine to regenerate
   `tools/wiki-drift/fingerprint.baseline.json` against the now-current wiki.
4. Open a PR whose diff is the regenerated baseline (and any artifact change from step 2).
5. The PR body carries `Closes #N` for the tracker issue. Merging closes it.

A clean run does **not** auto-close an open tracker issue — closing is the human act of accepting
a baseline, performed on this PR.

## 4. The four outcomes

| Outcome | Exit code | Meaning |
| --- | --- | --- |
| `ok` | 0 | The fingerprint matches the baseline in every field. No issue is created or updated. |
| `drift` | 1 | At least one section hash, the whole-payload hash, or the catalog version differs. The job fails and the tracker issue is opened/updated. |
| `unreachable` | 2 | The wiki could not be reached, or answered with something that is not a JSON object (including a `200` with an HTML body). Never reported as drift. |
| `baseline-missing` | 3 | The committed baseline is absent, unreadable, unparseable, or internally inconsistent. Decided before any network request. |

A fetch failure is structurally incapable of becoming a drift claim: the stages run in a fixed
order (read + validate the baseline, then fetch, then compare), and comparison is only reachable
once both endpoints have answered with a parseable JSON object.

## 5. The reorder-only signature

`JSON.stringify` preserves key order. If the wiki's server-side response reorders its top-level
keys with no value change, the whole-payload hash flips while every per-section hash still
matches. That signature — a `payload-changed` diff with zero `section-changed` diffs — is
recognisable at a glance and is named explicitly in the run summary and the issue body as the
reorder-only case, so it is cheap to triage rather than mistaken for a real data change.

## 6. The recurring cost

One job, one `ubuntu-latest` runner, no dependency install, two HTTPS GETs (roughly 215 KB total),
one hash pass, one comparison, and at most one issue API call — about ten seconds of real work.
GitHub bills whole minutes per job, so this is budgeted at **one billed minute per run, roughly
30–31 billed minutes per month**. For comparison, `nightly.yml`'s own schedule is currently
disabled specifically to save Actions minutes, and when it did run it used two jobs (one of them a
45-minute `windows-latest` packaging build, which bills at double the Linux rate on a private
repo). This job's monthly cost is a small fraction of a single one of those runs.

## 7. The adjacency, removed

`packages/game-data/src/parsers/inventory.ts` used to build a wiki asset URL (`computeIconUrl`)
into `InventoryItem.iconUrl`, from the item's instance level. Nothing ever rendered that field, and
both the builder and the field are now **deleted**: item art is bundled-only. The item-icon and
ability-icon components read `itemIconSrc`/`abilityIconSrc` from
`packages/domain/src/wiki-assets.ts`, which resolve local files bundled in
`packages/game-art/assets/` (copied into each app's own `public/wiki-assets/` at build time, see
`docs/design-system.md`'s Game art section), never a live wiki URL.

No shipped code composes a wiki URL at runtime any more. The narrowed-rule guard's hostname census
(`tools/wiki-drift-narrowed-rule.test.mjs`) is correspondingly **7 files, 11 matches** — credit
links, i18n strings, a test title, a provenance comment, and the `WIKI_URL` constant itself. Adding
an eighth entry means something new names the wiki host in shipped code; that is a reviewable diff
by construction, and if it is a runtime dependency it needs this doc and the rule in §1 amended
first.
