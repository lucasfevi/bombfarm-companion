import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STRINGS,
  sub,
  parseEmphasis,
  loadLang,
  saveLang,
  type Lang,
  type Strings,
  type ExplainSection,
} from '@/shared/i18n';
import * as chrome from '@/shared/i18n/namespaces/chrome';
import * as planner from '@/shared/i18n/namespaces/planner';
import * as gear from '@/shared/i18n/namespaces/gear';
import * as abilities from '@/shared/i18n/namespaces/abilities';
import * as account from '@/shared/i18n/namespaces/account';
import * as advice from '@/shared/i18n/namespaces/advice';
import * as breakdown from '@/shared/i18n/namespaces/breakdown';
import * as phases from '@/shared/i18n/namespaces/phases';
import * as teamPlan from '@/shared/i18n/namespaces/team-plan';
import * as importNs from '@/shared/i18n/namespaces/import';
import * as stats from '@/shared/i18n/namespaces/stats';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * Fixture re-baseline — 2026-08-17.
 *
 * `apps/web/src/tests/fixtures/i18n-strings-main.json` was regenerated from live `STRINGS`
 * (both `en` and `pt`), as its own deliberate, standalone, tracked change — not as part of a
 * feature PR. Every declared-delta list below (`KEYS_REMOVED`, `KEYS_ADDED`,
 * `PROSE_EDITED_PATHS`) is empty as of this re-baseline: the fixture and live `STRINGS` are the
 * same shape, key for key, value for value.
 *
 * Why this is a *deliberate, rare* move and not a routine fix: the whole point of comparing
 * `STRINGS` against a frozen snapshot is to catch UNINTENDED copy drift. If the fixture is
 * regenerated inside the same PR that changes the copy, the comparison degrades to
 * `STRINGS == STRINGS` — permanently green, permanently blind to the very drift it exists to
 * catch. So between re-baselines the fixture stays byte-unchanged (MOD-03, `docs/naming.md`),
 * and every feature that adds, removes, or rewords a string declares the change explicitly in
 * exactly one of the three lists below, with a comment naming the feature and explaining the
 * change. That declare-every-delta discipline is what makes an undeclared drift fail loudly.
 *
 * A re-baseline resets those lists to empty once they have accumulated across enough features
 * that they stop reading as a meaningful diff and start reading as bookkeeping for its own
 * sake — this one followed ten named lists and 114 declared entries in this file. It does not
 * loosen the comparison itself (still an exact match, not `objectContaining` — see AD-081, and
 * the note below on why that alternative is rejected); it only clears the backlog of old
 * entries and gives the mechanism a fresh floor to accumulate from.
 */
const fixturePath = join(WEB_PACKAGE_ROOT, 'src/tests/fixtures/i18n-strings-main.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  en: Strings;
  pt: Strings;
};

/**
 * Declare deltas here. A feature that changes `STRINGS` in a way that would otherwise fail one
 * of the parity checks below adds an entry to exactly one of these three lists — never by
 * loosening a comparison. Rather than an `objectContaining`-style comparison (which would stop
 * failing on *any* addition), this keeps the exact-match semantics and pins the exact set of
 * keys/paths allowed to differ from the frozen fixture; every other leaf, at every depth
 * (including inside `explainSections[].p[]`), must still match byte-for-byte.
 */

/**
 * Keys present in the frozen fixture that no longer exist in live STRINGS.
 *
 * The merged-row feature (2026-08-18) collapsed the Economy and Drops panels' wiki/yours ROW
 * PAIRS into one row per figure, showing the boosted total with the wiki base and the boost as
 * subtext. Each pair's two labels carried a parenthesised "(wiki)"/"(yours)" that the merged row
 * has no place for, so the six gold labels below have no reader left.
 *
 * `phasesXpPerProp` is deliberately NOT listed: the same feature revived it as the merged XP
 * row's label, and it is back in live STRINGS at the fixture's own value ("XP per prop" /
 * "XP por prop"). A key that leaves and returns unchanged is not a delta.
 *
 * The Cage panel rework (2026-08-19) moved the early-arrival row's explanation out of a
 * tooltip and into a new section description under the panel's art (`phasesJaulaSectionDesc`,
 * in `KEYS_ADDED`), so `phasesJaulaEarlyHint` has no reader left.
 *
 * The Farm Ranking redesign's third pass (2026-08-19) removed the FEASIBLE column and its
 * "Feasible only" filter switch from the board — the underlying `infeasible` row field and its
 * `@bombfarm/domain` computation are untouched, only the board's own column/filter went away, so
 * `farmRankingColInfeasible`, `farmRankingFilterFeasibleLabel` and `farmRankingInfeasibleBadge`
 * have no reader left. The same pass switched the difficulty filter's options from bare numbers
 * to `gameDifficultyLabel(ato, lang)` calls, which needed no new string.
 *
 * The Farm Ranking redesign's fourth pass (2026-08-19) removed the cage-window column from the
 * table entirely (the underlying `jaulaEarlyCapPct`/`jaulaWindowSecs` fields are untouched and
 * still read by the Phase explorer's own Cage panel), so `farmRankingColJaula` has no reader
 * left.
 *
 * The Farm Ranking redesign's sixth pass (2026-08-19) dropped the trailing "consumed"/"consumidas"
 * annotation from the keys cell — a gate row now reads the signed rate alone (`-15.5/h`), the same
 * shape a non-gate row's gain already has — so `farmRankingKeysConsumed` has no reader left. The
 * same pass replaced the row's "Gate" chip with the game's own clock icon; `farmRankingGateBadge`
 * itself is untouched, now carried as the icon's tooltip and `sr-only` accessible name.
 *
 * Gold-only, second pass (2026-08-20): with the chests objective gone, the search always compares
 * the current build as one of its own candidates, so the proposed build's gold can never come in
 * BELOW it. `resolvePaybackKind`'s third kind was therefore unreachable and is deleted, leaving
 * `farmRespecPaybackNoGoldGain` with no reader.
 *
 * The toolbar headline (2026-08-20) is now the lower-bound gain alone. The recommended phase,
 * the respec cost and the payback are all in the panel's metric tiles one click away; restated on
 * the toolbar they made a single line carry four facts before the player could make the only
 * decision it supports — whether to open the panel. So `farmRespecHeadlinePhase` and
 * `farmRespecHeadlineCost` have no reader left.
 *
 * The objective picker's removal (2026-08-20): the solver optimizes gold/hr and nothing else now
 * — offering chests/blend as a choice was misleading without also being able to filter which
 * chest, so the picker is gone, not merely relabelled. `farmRespecObjectiveLabel` (its
 * `aria-label`), `farmRespecObjectiveGold`, `farmRespecObjectiveBlend` and
 * `farmRespecObjectiveChests` (its three options) all lose their reader together. The panel's
 * chest explainer, gated on a non-gold objective that can no longer be selected, goes with it —
 * `farmRespecChestExplainer`. The gold tile's "gives up N gold/hr" line
 * (`farmRespecGoldGivenUp`) turns out to have been dead under a pure gold objective even before
 * this change (the solver maximises gold, so the proposed rate can only be `>=` the current one
 * by construction) — confirmed against `packages/domain/src/farm-optimize.ts`'s search, which
 * always includes the current build as a candidate, so removing the objective choice only made
 * that already-unreachable branch official.
 *
 * The unchanged-hero group (2026-08-20): every hero needing no respec repeated the same two
 * lines on its own card. They are now stated once above the group, over the summed gold those
 * builds save (`farmRespecUnchangedGroupNote`, in `KEYS_ADDED`), so the per-card
 * `farmRespecUnchangedNote` and `farmRespecUnchangedGoldSaved` have no reader left.
 *
 * The Respec Advisor's energy-allocation section (2026-08-20) is gone in two steps: its bar first,
 * then the sentence beneath it, so `farmRespecPlateauLabel`, `farmRespecPlateauRange` and
 * `farmRespecPlateauSharp` have no reader left. The domain's `plateau` field and everything that
 * computes it are untouched.
 * The Account page rework (2026-08-22) split the one big Account panel into an identity header, a
 * House panel and a Skill Tree panel, mirroring how the Farm page is built from small focused
 * sections. The farm-phase field, the target-prop picker and the team-buff fields left the page
 * entirely, taking `accountFarmSection`/`accountFarmPhaseLabel`/`accountFarmPhaseHint`/
 * `accountTargetPropHint`/`panelTeamBuffs`/`teamBuffsAutoFill`/`deployedTitle` with them. The
 * panel-wide `accountTip` and the `accountWide` chip are superseded by each new panel's own
 * description, `accountTreeUnsetNote` and `treeCritDmgShort` lost their last readers with the old
 * tree fields, and `houseRestHint`/`houseLvl` are replaced by the House panel's own rows
 * (`accountHouseCycle`, `houseLevelLabel` as `X / 20`).
 *
 * Several PROSE edits ride along and are deliberately NOT listed as deltas because the keys are
 * themselves new or already declared: the tree stat labels (`treeDano`, `treeCrit`, `treeCritDmg`,
 * `treeSpeed`, `treeEnergy`, `treeTeamCoin`, `treeXpMult`) are reworded to the game's own Bonus
 * summary wording — they are in `PROSE_EDITED_PATHS` below.
 *
 * The Account page (2026-08-22) promoted the planner's Account tab to a nav route of its own.
 * With no Account tab left in the tab strip, its label and its warn-tooltip title have no reader:
 * `tabAccount` is replaced by `navAccount` (in `KEYS_ADDED`) and `tabAccountWarnTitle` goes away
 * outright — `computePlannerTabStatuses` no longer returns an `accountTabStatus` at all.
 *
 * The star-multiplier change (2026-08-22) rewords `explainSections.0.p.0`, EN and PT
 * (in `PROSE_EDITED_PATHS`): the wiki's `gemas.mult_por_estrela` moved 0.5 -> 0.25, so the
 * formula those paragraphs quote moves `(1 + 0.5 x *)` -> `(1 + 0.25 x *)`. Copy only — the
 * sentence, the stat list and the Speed-is-exempt clause are all unchanged, because only the
 * magnitude moved and not the scope.
 *
 * The over-budget warning (2026-08-22) adds `pointsOverBudgetWarning` (in `KEYS_ADDED`). Both the
 * Points panel and the team plan's POINT RESET table can show a hero holding more stat points
 * than its level, which the game never grants; the panel's spent/level counter already turned red
 * on it but said nothing, and the reset table rendered an unclamped BEFORE against a clamped
 * AFTER. The new string is the one place that explains it and names the fix. No existing key
 * changed: the counter, `pointsUnspentBanked` and the reset-advice line are all untouched.
 *
 * The field-contention notice (2026-08-23) adds `farmRankingContentionTitle` and
 * `farmRankingContentionDesc` (both in `KEYS_ADDED`). The farm board's field cap is now priced
 * over the distribution of how many heroes hold full energy rather than over their mean, which
 * makes "how often is a rested hero benched behind a full field" a number the board actually
 * knows (`FarmRateRow.fieldContentionPct`). The banner is the one place that reports it and names
 * the fix — dropping the weakest heroes from the rotation pool. No existing key changed.
 */
const KEYS_REMOVED: readonly string[] = [
  'importSyncSummary',
  'importRemovedNote',
  'accountTargetPropHint',
  'accountFarmSection',
  'accountFarmPhaseLabel',
  'accountFarmPhaseHint',
  'accountTip',
  'accountTreeUnsetNote',
  'accountWide',
  'deployedTitle',
  'houseLvl',
  'houseRestHint',
  'panelTeamBuffs',
  'teamBuffsAutoFill',
  'treeCritDmgShort',
  'tabAccount',
  'tabAccountWarnTitle',
  'farmRespecPaybackNoGoldGain',
  'farmRespecHeadlinePhase',
  'farmRespecHeadlineCost',
  'farmRespecObjectiveLabel',
  'farmRespecObjectiveGold',
  'farmRespecObjectiveBlend',
  'farmRespecObjectiveChests',
  'farmRespecChestExplainer',
  'farmRespecGoldGivenUp',
  'farmRespecUnchangedNote',
  'farmRespecUnchangedGoldSaved',
  'farmRespecPlateauLabel',
  'farmRespecPlateauRange',
  'farmRespecPlateauSharp',
  'phasesGoldComumWiki',
  'phasesGoldComumActual',
  'phasesAvgGoldWiki',
  'phasesAvgGoldActual',
  'phasesMapGoldWiki',
  'phasesMapGoldActual',
  'phasesJaulaEarlyHint',
  'farmRankingColInfeasible',
  'farmRankingFilterFeasibleLabel',
  'farmRankingInfeasibleBadge',
  'farmRankingColJaula',
  'farmRankingKeysConsumed',
  // Farm board redesign (2026-08-19): the locked-phase "Push target" badge is withdrawn — it
  // wrapped onto a second line in the phase cell and grew every row it appeared on.
  'farmRankingPushTargetBadge',
];

/**
 * Keys present in live STRINGS with no counterpart in the frozen fixture at all — a genuinely
 * new key, not a reworded existing one. `diffLeafPaths` reports "present in STRINGS, absent
 * from the fixture" the same way it reports a changed value, so entries here are folded into
 * the "differs at exactly" comparisons alongside `PROSE_EDITED_PATHS`, and separately excluded
 * from the sorted-key-set comparison (which compares SETS, not diffs).
 *
 * The XP-multiplier / drop-chances feature (2026-08-18): the new Drops panel (gate-filtered rows
 * per drop type) and the Account import summary's new XP-multiplier row.
 *
 * The merged-row feature (same day) then collapsed each panel's wiki/yours pair into one row, so
 * the ten drop labels and the XP pair this list used to carry were replaced by the single-label
 * keys below before ever reaching a fixture re-baseline. They are dropped from this list rather
 * than moved to `KEYS_REMOVED`: they never existed in the frozen fixture, so their departure is
 * invisible to the comparison.
 *
 * `phasesBoost*` named the boost SOURCE in the merged row's subtext ("0.100% +17% luck"), which
 * the old paired rows expressed by labelling one row "(yours)". They are NOT listed below: the
 * tooltip-on-subtext feature (2026-08-19) dropped the trailing source word from every boosted
 * subtext ("0.100% + 17%" — the tooltip now carried on the subtext itself explains the source
 * instead), so `phasesBoostXp`/`phasesBoostGold`/`phasesBoostLuck` lost their only reader in the
 * same feature that added them. Same precedent as the drop labels above: a key that was added and
 * removed before ever reaching a fixture re-baseline is dropped from this list rather than moved
 * to `KEYS_REMOVED` — it never existed in the frozen fixture, so its departure is invisible to
 * the comparison.
 *
 * The all-five-rows feature (2026-08-19): the Drops panel used to skip rows that cannot roll on
 * the phase being viewed, so a gate phase showed 4 rows and a normal phase showed 2. It now
 * always shows all 5, dimming the ones that do not apply and replacing their live percentage
 * with a dash plus a small note naming which phase type the drop IS specific to —
 * `phasesDropGateOnly` for the time/gem/stone chests, `phasesDropNonGateOnly` for the key.
 *
 * `phasesDropsSectionDesc` (2026-08-19): the gate/non-gate sentence moved out of the per-row boost
 * tooltip and became the panel's section description. It describes the whole panel, not one row's
 * arithmetic, so repeating it inside every row's tooltip made the tooltip say two unrelated things
 * and hid a panel-level fact behind a hover.
 *
 * The Cage panel rework (2026-08-19), matching the Drops panel's own section-description move
 * above: `phasesJaulaSectionDesc` replaces the removed `phasesJaulaEarlyHint` tooltip as a
 * panel-level description under the new cage art. `phasesJaulaWindowVip` labels the VIP
 * guarantee window now shown as subtext under the normal window, once the committed wiki bundle's
 * stale VIP figure was corrected to match the live wiki.
 *
 * The metric tile row rework (2026-08-19) added a fifth Farm Respec Advisor tile —
 * `farmRespecMetricPhase` labels the recommended-phase before/after tile, and
 * `farmRespecMetricPhaseSame` is the muted note it shows in place of a repeated label when the
 * proposal does not move the phase. The tile also carries a tooltip explaining what the Payback
 * figure divides, since players were reading "pays for itself in N h" as computed against the NEW
 * gold/hr rather than the increase over the current one: `farmRespecPaybackTip` is the tooltip
 * body, triggered by the Payback label itself (`TipLabel`) rather than a separate `?` control, so
 * no separate trigger-label key exists.
 *
 * The Account page (2026-08-22): `navAccount` is the new nav label (replacing the retired
 * `tabAccount`), and the ten `accountSave*`/`accountMaxPhase`/`accountLuckFlat`/
 * `accountFieldSlots`/`accountCasaSlots` keys are the new "From your save" panel — account-wide
 * values the save already carried but nothing rendered outside the import dialog.
 *
 * The Farm Ranking board's minimum-item-level filter (2026-08-23) is a fourth control beside the
 * unlocked/difficulty/gate ones, so it brings its own label, its no-floor option and the
 * `{level}` option template: `farmRankingFilterItemLevelLabel`,
 * `farmRankingFilterItemLevelAll`, `farmRankingFilterItemLevelOption`. Nothing existing was
 * reworded — the item-level COLUMN header (`farmRankingColItemLevel`) is a different string and
 * is untouched.
 *
 * The field-contention notice (2026-08-23) adds `farmRankingContentionTitle` and
 * `farmRankingContentionDesc` — a banner shown above the rotation pool when the field is full
 * often enough to matter. New strings only; nothing existing was reworded.
 *
 * `importSyncSummary` is REMOVED (2026-08-25). The created/updated/removed breakdown was
 * bookkeeping from when an import was a merge the player curated; the save is the source of truth
 * now, so the split between created and updated is not a decision they make or a number they act
 * on. `importRemovedNote` goes with it: it existed to explain what "Removed" meant, and under a
 * source-of-truth import a sentence about why absent heroes leave is not something the player
 * decides or acts on either. The removal BEHAVIOUR is unchanged.
 *
 * The blocked-hero explanation (2026-08-25) adds seven `importBlocked*` keys. A hero the planner
 * cannot rebuild used to be dimmed and nothing else, which reads as a rendering glitch rather
 * than an explanation; the dialog now names the heroes, both causes (the save is older than the
 * game, or the planner is), and the action for each. New strings only — nothing existing was
 * reworded, and in particular `importIssuesCount` and the three `importPoint*` strings are
 * untouched.
 *
 * The first-run referral notice (2026-08-27) adds five `referralNotice*` keys — the topbar chip
 * and the footer line state the code and the mutual reward, but neither has room to say what a
 * player has to do with it or that the game accepts one code per account, once. New strings
 * only; the existing `referral*` keys behind those two surfaces are untouched.
 *
 * The missing-required-save-field banner (issue #141) adds `accountMissingFieldsTitle` and
 * `accountMissingFieldsBody`. Every account panel is read-only, so a save that omits the skill
 * tree, the House, the House level, the current phase or the furthest phase leaves the planner
 * permanently wrong about it with nothing on screen saying so. The banner names the fields and
 * asks for a fresh export; it borrows the Account page's own labels for the field names rather
 * than adding five more keys.
 */
const KEYS_ADDED: readonly string[] = [
  'accountMissingFieldsTitle',
  'accountMissingFieldsBody',
  'referralNoticeTitle',
  'referralNoticeBody',
  'referralNoticeReward',
  'referralNoticeCopy',
  'referralNoticeDismiss',
  'importBlockedTitle',
  'importBlockedBody',
  'importBlockedOldSave',
  'importBlockedAppBehind',
  'importBlockedRest',
  'importBlockedBadge',
  'importBlockedTooltip',
  'farmRankingContentionTitle',
  'farmRankingContentionDesc',
  'farmRankingFilterItemLevelLabel',
  'farmRankingFilterItemLevelAll',
  'farmRankingFilterItemLevelOption',
  'pointsOverBudgetWarning',
  'accountTreeGroupDamage',
  'accountTreeGroupField',
  'accountTreeGroupRewards',
  'accountCasaSlots',
  'accountFieldSlots',
  'accountLuckFlat',
  'accountMaxPhase',
  'treeXpMult',
  'accountIdentityTip',
  'accountPlayerName',
  'accountIdLabel',
  'accountCurrentPhase',
  'accountHouseTip',
  'accountHouseTipMaxed',
  'accountHouseCycle',
  'accountHouseCycleTip',
  'accountCasaSlotsTip',
  'accountNextHouse',
  'accountTreeTip',
  'accountSquadDmg',
  'accountGeoMult',
  'accountTotalDmgTip',
  'accountFieldSlotsTip',
  'accountBonusOfTotal',
  'accountBagTabs',
  'navAccount',
  'farmRespecUnchangedGroupNote',
  'phasesXpActualHint',
  'phasesDropsSection',
  'phasesDropChest',
  'phasesDropKey',
  'phasesDropTime',
  'phasesDropGem',
  'phasesDropStone',
  'phasesDropActualHint',
  'phasesDropsSectionDesc',
  'phasesGoldComum',
  'phasesAvgGold',
  'phasesMapGold',
  'phasesDropGateOnly',
  'phasesDropNonGateOnly',
  'phasesJaulaSectionDesc',
  'phasesJaulaWindowVip',
  'farmRespecMetricPhase',
  'farmRespecMetricPhaseSame',
  'farmRespecPaybackTip',
  // The Phases hero/squad panel rework (2026-08-20): the hero panel breaks its single
  // crit-weighted "avg hit" into normal/crit/average plus field time, and the Top-N table trades
  // gear, abilities and power — roster facts that say nothing about this phase — for the same
  // three per-phase combat numbers. Four stat labels and three (shorter) column headers.
  'phasesNormalHit',
  'phasesCritHit',
  'phasesFieldTime',
  'phasesColNormalHit',
  'phasesColCritHit',
  'phasesColFieldTime',
];

/**
 * Leaf paths whose key survives in both the fixture and STRINGS but whose VALUE changed — e.g.
 * a reworded sentence, in either or both languages. Dot-separated; array indices are numeric
 * segments (`explainSections.0.p.1`). A deleted key and an edited value are different shapes of
 * drift, which is why they are two separate lists rather than one.
 *
 * The tooltip-on-subtext feature (2026-08-19): `phasesGoldActualHint` was reworded from
 * "Wiki × (1 + team coin % on Account)" to "base value × (1 + your skill tree's team coin %)" —
 * "Wiki" -> "base value" for the same reason the drop-chance hint moved (the merged row already
 * shows the wiki number inline, so calling it "Wiki" a second time in the tooltip was the
 * confusing name), plus naming the account.tree source explicitly to match the drop-chance hint's
 * "your skill tree's luck" phrasing. `phasesXpActualHint` and `phasesDropActualHint` got the
 * same edit but are not listed here: both are already in `KEYS_ADDED` above (added since the last
 * re-baseline, never yet in the frozen fixture), and an added key's value is unconstrained by the
 * comparison regardless of what it is.
 *
 * The Cage panel rework (2026-08-19) dropped the "(hero clock)" / "(relógio de herói)" suffix
 * from `phasesJaulaSection` now that the panel's own art and description carry that context, and
 * reworded `phasesJaulaEarly` ("Early cap at this phase" -> "Early-arrival chance at this phase")
 * to name what the number actually is now that its explanation no longer sits one hover away.
 *
 * The crit/cooldown regime revert (2026-08-19) reworded the Points tab's "Skill points add a fixed
 * share..." paragraph (`explainSections.0.p.1`) in both locales, back to describing crit chance and
 * cooldown as a percent of the birth roll — the 2026-08-18 game patch reverted the flat-addend
 * shape the 2026-08-15 one had introduced.
 *
 * The Farm Ranking redesign (2026-08-19) moved "/hr" off the six rate column headers
 * (`farmRankingColGold`/`Chests`/`Keys`/`Gems`/`TimePieces`/`Xp`) and onto each cell's own value
 * instead (`formatRatePerHour`/`formatSignedRatePerHour` in `farm-ranking-format.ts`). The
 * chest/key/gem/time-piece headers were reworded to the Drops panel's own vocabulary at the same
 * time (e.g. "Chests / hr" -> "Item chest"); that wording now survives as the tooltip and
 * screen-reader text behind each header's icon.
 */
const PROSE_EDITED_PATHS: readonly string[] = [
  'treeDano',
  'treeCrit',
  'treeCritDmg',
  'treeSpeed',
  'treeEnergy',
  'treeTeamCoin',
  'treeTeamCoinHint',
  'phasesGoldActualHint',
  'phasesJaulaSection',
  'phasesJaulaEarly',
  'explainSections.0.p.0',
  'explainSections.0.p.1',
  'farmRankingColGold',
  'farmRankingColChests',
  'farmRankingColKeys',
  'farmRankingColGems',
  'farmRankingColTimePieces',
  'farmRankingColXp',
  // The clear-time single-model fix (2026-08-20): the squad panel now prints the ranking board's
  // own `clearSecs` for the selected phase instead of modelling clear time a second way, so
  // `phasesClearDisclaimer` no longer describes a "mid-map sustained" estimate.
  'phasesClearDisclaimer',
];

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = { ...obj };
  for (const key of keys) delete out[key];
  return out as Partial<T>;
}

function diffLeafPaths(a: unknown, b: unknown, path: string[] = [], out: string[] = []): string[] {
  if (a === b) return out;
  const aIsObj = a !== null && typeof a === 'object';
  const bIsObj = b !== null && typeof b === 'object';
  if (aIsObj && bIsObj) {
    const aKeys = Array.isArray(a) ? a.map((_, i) => String(i)) : Object.keys(a);
    const bKeys = Array.isArray(b) ? b.map((_, i) => String(i)) : Object.keys(b);
    for (const key of new Set([...aKeys, ...bKeys])) {
      diffLeafPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], [
        ...path,
        key,
      ], out);
    }
    return out;
  }
  out.push(path.join('.'));
  return out;
}

const namespaces = [
  chrome,
  planner,
  gear,
  abilities,
  account,
  advice,
  breakdown,
  phases,
  teamPlan,
  importNs,
  stats,
] as const;

describe('i18n split parity', () => {
  // The fixture (apps/web/src/tests/fixtures/i18n-strings-main.json) is MOD-03-frozen
  // (docs/naming.md:74) between re-baselines (see the file-top comment for the 2026-08-17
  // one). Parity is measured against the fixture minus KEYS_REMOVED — every undeclared drift
  // stays fatal in both directions.
  it('STRINGS.en differs from the frozen fixture (minus declared-removed keys) at exactly the declared deltas', () => {
    const diffs = diffLeafPaths(STRINGS.en, omitKeys(fixture.en, KEYS_REMOVED)).sort();
    expect(diffs).toEqual([...PROSE_EDITED_PATHS, ...KEYS_ADDED].sort());
  });

  it('STRINGS.pt differs from the frozen fixture (minus declared-removed keys) at exactly the declared deltas', () => {
    const diffs = diffLeafPaths(STRINGS.pt, omitKeys(fixture.pt, KEYS_REMOVED)).sort();
    expect(diffs).toEqual([...PROSE_EDITED_PATHS, ...KEYS_ADDED].sort());
  });

  it('namespace key sets are pairwise disjoint', () => {
    const seen = new Map<string, string>();
    for (const ns of namespaces) {
      for (const key of Object.keys(ns.en)) {
        const prior = seen.get(key);
        expect(prior, `duplicate key ${key} also in ${prior}`).toBeUndefined();
        seen.set(key, 'present');
      }
    }
  });

  it('sorted key-name list is unchanged vs fixture minus declared-removed keys, plus declared-added keys', () => {
    const fromSplit = Object.keys(STRINGS.en).sort();
    const fromFixture = [...Object.keys(omitKeys(fixture.en, KEYS_REMOVED)), ...KEYS_ADDED].sort();
    expect(fromSplit).toEqual(fromFixture);
  });

  it('every declared-removed key was present in the frozen fixture, both languages', () => {
    for (const key of KEYS_REMOVED) {
      expect(key in fixture.en, `${key} missing from fixture.en`).toBe(true);
      expect(key in fixture.pt, `${key} missing from fixture.pt`).toBe(true);
    }
  });

  it('every declared-removed key is absent from STRINGS, both languages', () => {
    for (const key of KEYS_REMOVED) {
      expect(key in STRINGS.en, `${key} still present in STRINGS.en`).toBe(false);
      expect(key in STRINGS.pt, `${key} still present in STRINGS.pt`).toBe(false);
    }
  });

  it('every declared-added key is absent from the frozen fixture and present in STRINGS, both languages', () => {
    for (const key of KEYS_ADDED) {
      expect(key in fixture.en, `${key} unexpectedly present in fixture.en`).toBe(false);
      expect(key in fixture.pt, `${key} unexpectedly present in fixture.pt`).toBe(false);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
    }
  });

  it('the combined level option label carries both placeholders, in both languages', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].itemLevelOpt).toContain('{n}');
      expect(STRINGS[lang].itemLevelOpt).toContain('{set}');
      // The separator the design asks for: space-hyphen-space between level and set.
      expect(STRINGS[lang].itemLevelOpt).toMatch(/\{n\} - \{set\}$/);
    }
    expect(sub(STRINGS.en.itemLevelOpt, { n: 300, set: 'Void' })).toBe('Level 300 - Void');
    expect(sub(STRINGS.pt.itemLevelOpt, { n: 300, set: 'Vazio' })).toBe('Nível 300 - Vazio');
  });

  it('sub() behaves identically on existing fixtures', () => {
    expect(sub('a {x}', { x: 1 })).toBe('a 1');
    expect(sub('Need {pct}% pen', { pct: 12 })).toBe('Need 12% pen');
    expect(sub('missing {gone}', {})).toBe('missing ');
  });

  it('parseEmphasis() behaves identically on existing fixtures', () => {
    expect(parseEmphasis('plain')).toEqual([{ kind: 'text', value: 'plain' }]);
    expect(parseEmphasis('before <em>mid</em> after')).toEqual([
      { kind: 'text', value: 'before ' },
      { kind: 'em', value: 'mid' },
      { kind: 'text', value: ' after' },
    ]);
  });

  it('public API symbols resolve with expected shapes', () => {
    const langs: Lang[] = ['en', 'pt'];
    expect(langs.every((l) => STRINGS[l])).toBe(true);
    expect(typeof loadLang).toBe('function');
    expect(typeof saveLang).toBe('function');
    const section: ExplainSection = { h: 'x', p: ['y'] };
    expect(section.h).toBe('x');
  });
});

/**
 * EN and PT key sets are structurally equal (compile-time via `pt: typeof en`,
 * asserted again here at runtime) and no PT value for a Farm Ranking key is byte-identical to
 * its EN counterpart, except an explicit allowlist. `navPhases` ("Farm") is the
 * design's own allowlisted collision. `farmRankingReturnBonusVip` ("VIP") is added on the same
 * rationale — a universal loanword used unchanged in Brazilian Portuguese gaming UI, not a
 * missed translation. `farmRankingColXp` ("XP") joins them for the same reason once the fourth
 * pass dropped its "/hr"/"/ h" suffix — the abbreviation itself was never translated.
 */
describe('Farm Ranking i18n parity', () => {
  const EN_PT_COLLISION_ALLOWLIST = new Set([
    'navPhases',
    'farmRankingReturnBonusVip',
    'farmRankingColXp',
  ]);

  it('EN and PT key sets are equal at runtime', () => {
    expect(Object.keys(STRINGS.pt).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it('no farmRanking* PT value is byte-identical to its EN counterpart, except the allowlist', () => {
    const leaks: string[] = [];
    for (const key of Object.keys(STRINGS.en)) {
      if (!key.startsWith('farmRanking') && key !== 'navPhases') continue;
      if (EN_PT_COLLISION_ALLOWLIST.has(key)) continue;
      const enValue = STRINGS.en[key as keyof Strings];
      const ptValue = STRINGS.pt[key as keyof Strings];
      if (typeof enValue === 'string' && enValue === ptValue) leaks.push(key);
    }
    expect(leaks, `EN string left untranslated in PT: ${leaks.join(', ')}`).toEqual([]);
  });
});

/**
 * Farm Respec Advisor T7 — same shape as `Farm Ranking i18n parity` above. None of these
 * strings legitimately collides between EN and PT, so no allowlist entry is needed.
 */
describe('Farm Respec Advisor i18n parity', () => {
  it('no farmRespec* PT value is byte-identical to its EN counterpart', () => {
    const leaks: string[] = [];
    for (const key of Object.keys(STRINGS.en)) {
      if (!key.startsWith('farmRespec')) continue;
      const enValue = STRINGS.en[key as keyof Strings];
      const ptValue = STRINGS.pt[key as keyof Strings];
      if (typeof enValue === 'string' && enValue === ptValue) leaks.push(key);
    }
    expect(leaks, `EN string left untranslated in PT: ${leaks.join(', ')}`).toEqual([]);
  });
});
