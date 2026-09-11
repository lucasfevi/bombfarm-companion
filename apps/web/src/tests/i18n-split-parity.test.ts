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
import * as teamPlanGearFlow from '@/shared/i18n/namespaces/team-plan-gear-flow';
import * as teamPlanObjective from '@/shared/i18n/namespaces/team-plan-objective';
import * as importNs from '@/shared/i18n/namespaces/import';
import * as stats from '@/shared/i18n/namespaces/stats';
import * as market from '@/shared/i18n/namespaces/market';
import * as inventory from '@/shared/i18n/namespaces/inventory';
import * as download from '@/shared/i18n/namespaces/download';
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
 * catch. So between re-baselines the fixture stays byte-unchanged (`docs/naming.md`),
 * and every feature that adds, removes, or rewords a string declares the change explicitly in
 * exactly one of the three lists below, with a comment naming the feature and explaining the
 * change. That declare-every-delta discipline is what makes an undeclared drift fail loudly.
 *
 * A re-baseline resets those lists to empty once they have accumulated across enough features
 * that they stop reading as a meaningful diff and start reading as bookkeeping for its own
 * sake — this one followed ten named lists and 114 declared entries in this file. It does not
 * loosen the comparison itself (still an exact match, not `objectContaining`, and
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
 * knows (`FarmRateRow.fieldContentionPct`). The banner is the one place that reports it. No
 * existing key changed.
 *
 * That notice is reworded and gains `farmRankingContentionTitleMaxSlots` /
 * `farmRankingContentionDescMaxSlots` (2026-08-27) — see the `KEYS_ADDED` note above for why both
 * original strings change.
 * The Team plan objective control (2026-09-06) lets a player score the search for gold per hour
 * instead of combined roster damage, and defaults to gold. Nine strings on that page named the
 * quantity being reported, so each is replaced by a `…Dps`/`…Farm` pair in `KEYS_ADDED` and the
 * unsuffixed original loses its reader: `teamPlanSetupSectionBody`,
 * `teamPlanRunSummaryRegimeHintSaturated`, `teamPlanTotalGainValue`, `teamPlanResultsHeader`,
 * `teamPlanGearDipNote`, `teamPlanSaturationCallout`, `teamPlanAuraDisclosure`,
 * `teamPlanPlannerDivergence` and `teamPlanForgeSkippedNote`. A pair rather than one templated
 * string because the unit differs (dps against gold/h) and a template cannot carry a unit.
 */
const KEYS_REMOVED: readonly string[] = [
  'navTeamPlan',
  // Split into `…Both`/`…Points`/`…Gear` (in `KEYS_ADDED`): the one string named gear moves and
  // point resets whatever Allowed changes was set to.
  'teamPlanOptimizeAria',
  // Split into a Dps/Farm pair (in `KEYS_ADDED`): the per-hero rows are DPS whatever the roster
  // was scored on, so under gold this note claimed figures were "what the search actually
  // optimizes against" when they are a different quantity from the total above them.
  'teamPlanHeroDeltaNote',
  'teamPlanSetupSectionBody',
  'teamPlanRunSummaryRegimeHintSaturated',
  'teamPlanTotalGainValue',
  'teamPlanResultsHeader',
  'teamPlanGearDipNote',
  'teamPlanSaturationCallout',
  'teamPlanAuraDisclosure',
  'teamPlanPlannerDivergence',
  'teamPlanForgeSkippedNote',
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
  'farmRespecHeadlineGain',
  'farmRespecGateFailed',
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
  // The roster-wide reset banner is withdrawn (2026-08-31). It restated, across the top of the
  // planner, advice the hero strip's warn border and the Points panel's own gain line already
  // carry for the hero being looked at. Its two strings have no reader left.
  'resetAdviceRosterBanner',
  'resetAdviceRosterHero',
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
 * That notice is REWORDED and gains a maxed-field variant (2026-08-27):
 * `farmRankingContentionTitleMaxSlots` and `farmRankingContentionDescMaxSlots`. Both original
 * strings change. `farmRankingContentionDesc` claimed the gold/hr estimate does not model the
 * wait, which stopped being true when `concurrencyScale` became the queue's served share and
 * started charging exactly that wait; it now reports the cost instead of denying it. And it
 * prescribed more field slots unconditionally, which is not advice to a player already at the
 * cap — the new variant says the wait is structural for them.
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
 *
 * The inventory surface (2026-08-26) adds `navInventory` and the `inventory*` block: a new
 * route listing every item a save carries, not just the gear the optimizer pools. The five
 * `inventoryGroup*` keys name the item kinds; `inventoryGroupOther` and
 * `inventoryUnknownCategory` exist because the catalog names gear only, so an item type a patch
 * adds is shown and labelled unknown rather than silently filed as gear.
 *
 * The market-price data layer (2026-08-29) adds the `market*` block. Two of the strings exist
 * because Steam prices each region independently instead of converting: a native quote is the
 * number on the page an item links to, a converted one is derived from USD and is not, so the
 * tooltip has to say which of the two it is showing. The `marketAge*` set is the vocabulary of
 * the relative-age formatter, which dates a quote by its OWN timestamp rather than the
 * snapshot's — a rate-limited run republishes the file while leaving an individual quote hours
 * older, and dating it to the file would claim a freshness the quote does not have.
 *
 * The inventory list layout (2026-08-29) adds the `inventoryView*`, `inventoryColumn*`,
 * `inventoryTableCaption`, `inventoryRowAction` and `inventorySortMarket` keys. The table is a
 * second layout over the same items, so its column headers reuse the existing sort-key labels
 * rather than adding a parallel set; only the two columns the cards have no equivalent for
 * (equipped-by, row actions) and the table's own accessible caption are new. `inventoryRowAction`
 * takes the item name because a row control repeats down the page, and a column of identically
 * named buttons names nothing to a screen reader. `inventorySortMarket` is the new sort key that
 * orders by what the market is asking for an item.
 *
 * The Priced filter and the totals header (2026-08-30): `inventoryFilterPriced` narrows to the
 * items the market is quoting right now. `inventoryTotalsCoverage` says how much of the inventory
 * the headline figure actually covers, counted against TRADABLE items rather than all of them —
 * the game forbids selling the rest, so they were never candidates for a price and counting them
 * would make the coverage read worse than it is.
 *
 * The table's per-host column set (2026-09-05) adds `inventoryColumnForge`. The table is shared
 * with a screen that lists gear only and needs that column; the label bag names every column the
 * table can draw, the way it already named the row actions this page's list layout does not use,
 * so one vocabulary covers both hosts.
 *
 * The download page's mini-window section (2026-09-01) adds `downloadMiniHeading`,
 * `downloadMiniLede` and `downloadMiniControlsTitle`. The section is the page's own chrome around
 * a drawing of the desktop app's compact Live window; every label inside the drawing and its
 * controls is mirrored from the desktop shell in `live-replica-copy.ts` instead, under the drift
 * guard, so only the three strings the web page says in its own voice live here.
 * The Team plan objective control (2026-09-06) adds the control itself — `teamPlanObjectiveLabel`,
 * `teamPlanObjectiveAria`, `teamPlanObjectiveOptionDamage`, `teamPlanObjectiveOptionGold`, the hint
 * under it (`teamPlanObjectiveHintDps`/`Farm`) and the warning shown when a record carries no
 * furthest-phase for gold to be priced against (`teamPlanObjectiveFarmNeedsMaxPhase`) — plus the
 * `…Dps`/`…Farm` half of each string listed in `KEYS_REMOVED`. `teamPlanFarmAdvisorPointer` is the
 * one that renders elsewhere: the Farm page's respec advisor now states that it moves stat points
 * only, and the web planner appends this pointer to the Team plan page. The desktop app has no
 * such page and passes nothing, so the shared panel names no destination there.
 * `farmRespecPointsOnly` is that advisor's own scope sentence, and lives in the shared farm copy
 * because it is true on both apps.
 *
 * The Team plan phase picker (2026-09-07) adds the control (`teamPlanPhaseLabel`,
 * `teamPlanPhaseAria`, `teamPlanPhaseNone`, `teamPlanPhaseSearchPlaceholder`,
 * `teamPlanPhaseNoMatch`, `teamPlanPhaseMoreMatches`), the two hints under it
 * (`teamPlanPhaseHintNone`/`Chosen`), the note for a phase past the account's furthest
 * (`teamPlanPhaseBeyondMax`), and the run summary's read-back of which phase the plan was scored
 * at, one string per way the phase was arrived at (`teamPlanRunSummaryScoredPhase`,
 * `teamPlanScoredPhaseChosen`, `teamPlanScoredPhaseAccount`, `teamPlanScoredPhaseSearched`,
 * `teamPlanScoredPhaseUnreachable`, `teamPlanScoredPhaseNoneFeasible`). None of these are
 * objective-suffixed: a phase is a phase under either objective, and the read-back reports one.
 *
 * The honest price-freshness fix (2026-09-08) replaces `marketPricesUpdated` with
 * `marketPricesOldest`, reworded from "Prices updated {age}" to "Oldest price read {age}". The old
 * line was dated by the published file's own timestamp, which is the age of the publish and not of
 * any price shown — a rate-limited collection republishes the file while carrying individual
 * quotes forward untouched, so the summary read minutes while the rows beneath it were hours. The
 * line now takes the resolved prices it covers and states the oldest, the only age true of every
 * row above which it sits. `marketPricesUpdated` leaves this list rather than joining
 * `KEYS_REMOVED`: it postdates the frozen fixture and only ever lived here.
 *
 * The Team plan allowed-changes control (2026-09-07) adds the picker (`…Label`, `…Aria`, and its
 * three options `…OptionBoth`/`…OptionPoints`/`…OptionGear`), a hint per setting
 * (`…HintBoth`/`…HintPoints`/`…HintGear`), and the two Assumptions & limits lines that tell a
 * reader a restricted plan's empty list is a restriction and not a finding
 * (`…NotePoints`/`…NoteGear`). Not objective-suffixed, for the same reason the phase strings are
 * not: the restriction is on what the plan may propose, not on how it scores.
 */
const KEYS_ADDED: readonly string[] = [
  // The planner's Combat tab (2026-09-11). The desktop app's Heroes screen had a fourth stage the
  // planner did not: the phase the figures are for, one hero against it, and the per-statistic
  // breakdown — which here sat at the bottom of Points. One tab name is the only string this
  // app adds; the phase control's own words ship with the panel, in the package that draws it.
  'tabCombat',
  // The roster rail and board (2026-09-10). The planner had no roster surface of its own — the
  // hero strip's picker dialog was the only way to see the account at once — so it now draws the
  // same rail, board and toolbar the desktop app's Heroes screen does, from one implementation.
  // Nineteen strings, and every one of them is this app's own word rather than a copy of the
  // desktop's: the filter that keeps only the heroes in rotation says "Enabled heroes" here,
  // because "Enabled"/"Disabled" is what this planner has always called that flag.
  'heroesRosterTitle',
  'heroesRosterListLabel',
  'heroesRollQualityLabel',
  'heroesViewLabel',
  'heroesViewCards',
  'heroesViewList',
  'heroesSortLabel',
  'heroesSortRoll',
  'heroesSortPower',
  'heroesSortLevel',
  'heroesSortRarity',
  'heroesSortRank',
  'heroesSortStars',
  'heroesSortAscending',
  'heroesSortDescending',
  'heroesFilterActiveHeroes',
  'heroesAbilityFilterLabel',
  'heroesAbilityFilterOption',
  'heroesAbilityFilterAbsent',
  // The Optimizer's field-crowding opt-out (2026-09-09) and the removals section that made it
  // necessary. The plan could always take gear off a hero and hand it back — on a field that
  // cannot seat everyone, a weak hero wearing less crowds the others out less — but the page
  // rendered no row for it, so the piece simply vanished off the hero's card. The removals now
  // show on the hero they came off, with the reason, and the toggle plans without that term.
  'teamPlanIgnoreCrowdingLabel',
  'teamPlanIgnoreCrowdingAria',
  'teamPlanIgnoreCrowdingHintOff',
  'teamPlanIgnoreCrowdingHintOn',
  'teamPlanFlowRemovedHeading',
  'teamPlanFlowRowRemovedToInventory',
  'teamPlanFlowRemovedWhyCrowded',
  'teamPlanFlowRemovedWhyOther',
  'navOptimizer',
  'teamPlanOptimizeAriaBoth',
  'teamPlanOptimizeAriaPoints',
  'teamPlanOptimizeAriaGear',
  'teamPlanPhaseHintNoneDps',
  'teamPlanPhaseHintNoneFarm',
  // Luck is not part of `HeroSheet`, so no points search can reach it in either direction. The
  // page had never said so, which matters most under the gold objective: a stat that raises drop
  // rates, and so gold per hour, is being held still while gold per hour is optimized.
  'teamPlanLuckFrozenDps',
  'teamPlanLuckFrozenFarm',
  'teamPlanHeroDeltaNoteDps',
  'teamPlanHeroDeltaNoteFarm',
  'farmRespecPointsOnly',
  'teamPlanPhaseLabel',
  'teamPlanPhaseAria',
  'teamPlanPhaseNone',
  'teamPlanPhaseSearchPlaceholder',
  'teamPlanPhaseNoMatch',
  'teamPlanPhaseMoreMatches',
  'teamPlanPhaseHintChosen',
  'teamPlanPhaseBeyondMax',
  'teamPlanRunSummaryScoredPhase',
  'teamPlanScoredPhaseChosen',
  'teamPlanScoredPhaseAccount',
  'teamPlanScoredPhaseSearched',
  'teamPlanScoredPhaseUnreachable',
  'teamPlanScoredPhaseNoneFeasible',
  'teamPlanAllowedChangesLabel',
  'teamPlanAllowedChangesAria',
  'teamPlanAllowedChangesOptionBoth',
  'teamPlanAllowedChangesOptionPoints',
  'teamPlanAllowedChangesOptionGear',
  'teamPlanAllowedChangesHintBoth',
  'teamPlanAllowedChangesHintPoints',
  'teamPlanAllowedChangesHintGear',
  'teamPlanAllowedChangesNotePoints',
  'teamPlanAllowedChangesNoteGear',
  'teamPlanObjectiveLabel',
  'teamPlanObjectiveAria',
  'teamPlanObjectiveOptionDamage',
  'teamPlanObjectiveOptionGold',
  'teamPlanObjectiveHintDps',
  'teamPlanObjectiveHintFarm',
  'teamPlanObjectiveFarmNeedsMaxPhase',
  'teamPlanFarmAdvisorPointer',
  'teamPlanSetupSectionBodyDps',
  'teamPlanSetupSectionBodyFarm',
  'teamPlanRunSummaryRegimeHintSaturatedDps',
  'teamPlanRunSummaryRegimeHintSaturatedFarm',
  'teamPlanTotalGainValueDps',
  'teamPlanTotalGainValueFarm',
  'teamPlanResultsHeaderDps',
  'teamPlanResultsHeaderFarm',
  'teamPlanGearDipNoteDps',
  'teamPlanGearDipNoteFarm',
  'teamPlanSaturationCalloutDps',
  'teamPlanSaturationCalloutFarm',
  'teamPlanAuraDisclosureDps',
  'teamPlanAuraDisclosureFarm',
  'teamPlanPlannerDivergenceDps',
  'teamPlanPlannerDivergenceFarm',
  'teamPlanForgeSkippedNoteDps',
  'teamPlanForgeSkippedNoteFarm',
  'downloadScreenForgeTitle',
  'downloadScreenForgeItem1',
  'downloadScreenForgeItem2',
  'downloadScreenForgeItem3',
  'downloadScreenForgeItem4',
  'downloadMiniHeading',
  'downloadMiniLede',
  'downloadMiniControlsTitle',
  'inventoryFilterPriced',
  'inventoryTotalsTitle',
  'inventoryTotalsCoverage',
  'inventorySortMarket',
  'inventoryViewLabel',
  'inventoryViewCards',
  'inventoryViewList',
  'inventoryTableCaption',
  'inventoryColumnEquippedBy',
  'inventoryColumnActions',
  'inventoryColumnForge',
  'inventoryRowAction',
  'marketNoListings',
  'marketNotOnMarket',
  'marketNotTradable',
  'marketQuoteNativeTooltip',
  'marketQuoteConvertedTooltip',
  'marketRefreshLabel',
  'marketRefreshName',
  'marketPricesOldest',
  'marketAgeJustNow',
  'marketAgeMinutes',
  'marketAgeHours',
  'marketAgeDays',
  'marketAgeUnknown',
  'accountMissingFieldsTitle',
  'accountMissingFieldsBody',
  'farmRespecNotWorthTitle',
  'farmRespecNotWorthDesc',
  'referralNoticeTitle',
  'referralNoticeBody',
  'referralNoticeReward',
  'referralNoticeCopy',
  'referralNoticeDismiss',
  'navInventory',
  'inventoryTitle',
  'inventoryTip',
  'inventoryGroupEquipment',
  'inventoryGroupGem',
  'inventoryGroupKey',
  'inventoryGroupTime',
  'inventoryGroupStone',
  'inventoryGroupChest',
  'inventoryGroupOther',
  'inventoryBadgeLocked',
  'inventoryBadgeMarketBlocked',
  'inventoryBadgeUnresolved',
  'inventoryDetailSetSlot',
  'inventoryDetailLevel',
  'inventoryEquippedByHero',
  'inventoryEquippedByUnknown',
  'inventoryGemAmethyst',
  'inventoryGemAquamarine',
  'inventoryGemCitrine',
  'inventoryGemDiamond',
  'inventoryGemEmerald',
  'inventoryGemOceanite',
  'inventoryGemRoselite',
  'inventoryGemRuby',
  'inventoryGemSapphire',
  'inventoryGemTopaz',
  'inventoryChestItem',
  'inventoryChestGem',
  'inventoryChestKey',
  'inventoryChestSkill',
  'inventoryChestTime',
  'inventorySearchPlaceholder',
  'inventorySearchLabel',
  'inventoryFilterAll',
  'inventoryFilterEquipped',
  'inventoryFilterClear',
  'inventoryFilterCount',
  'inventoryFilterNoMatches',
  'inventoryFilterHeroLabel',
  'inventoryFilterAllHeroes',
  'inventorySortLabel',
  'inventorySortRarity',
  'inventorySortLevel',
  'inventorySortValue',
  'inventorySortName',
  'inventorySortCount',
  'inventorySortAscending',
  'inventorySortDescending',
  'inventoryFilterSetsLabel',
  'inventoryFilterAllSets',
  'inventoryFilterSetsOwned',
  'inventoryFilterSetsSelected',
  'inventoryFilterSelectAllSets',
  'inventorySetOption',
  'inventoryUnknownCategory',
  'inventorySkipped',
  'inventoryEmptyTitle',
  'inventoryEmptyBody',
  'importBlockedTitle',
  'importBlockedBody',
  'importBlockedOldSave',
  'importBlockedAppBehind',
  'importBlockedRest',
  'importBlockedBadge',
  'importBlockedTooltip',
  'farmRankingContentionTitle',
  'farmRankingContentionDesc',
  'farmRankingContentionTitleMaxSlots',
  'farmRankingContentionDescMaxSlots',
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

  /**
   * The desktop download page (2026-08-30) — a standalone page at `/download` carrying the
   * installer link, the Windows SmartScreen walkthrough, the install count and what the desktop
   * app contains. All new prose on a page that did not exist before, so none of it edits an
   * existing string.
   *
   * The per-screen bullet lists are numbered keys rather than arrays on purpose. A new top-level
   * key holding an array diffs as one leaf path per element (`key.0`, `key.1`, ...) in the two
   * value comparisons but as the bare key name in the key-name comparison, so one entry here
   * cannot satisfy both — and the only way to make an array fit is to loosen one of them.
   *
   * The channel vocabulary is gone entirely (2026-08-31, second pass). Once a stable release
   * existed the page stopped being a menu of channels and became one download, so the chip beside
   * the button, both channel cards and the channel word in the file line all went with it — every
   * `downloadChannel*` key together. `downloadFileMeta` loses its `{channel}` placeholder for the
   * same reason. None of this is a fixture delta: the whole `download` namespace postdates the
   * frozen fixture, so these keys only ever lived in `KEYS_ADDED` and simply leave it.
   */
  'downloadNavLabel',
  'downloadHeaderCta',
  'downloadEyebrow',
  'downloadHeadlineLead',
  'downloadHeadlineAccent',
  'downloadLede',
  'downloadCta',
  'downloadFileMeta',
  'downloadFileMetaPending',
  'downloadTrustPermission',
  'downloadTrustUpdates',
  'downloadTrustLicense',
  'downloadTrustLicenseLink',
  'downloadInstallsSuffix',
  'downloadInstallHeading',
  'downloadStepRunTitle',
  'downloadStepRunBody',
  'downloadInstallerGenericName',
  'downloadStepWarnTitle',
  'downloadStepWarnBody',
  'downloadStepPermissionTitle',
  'downloadStepPermissionBody',
  'downloadSmartTitle',
  'downloadSmartBody',
  'downloadSmartMore',
  'downloadSmartApp',
  'downloadSmartPublisher',
  'downloadSmartRunAnyway',
  'downloadSmartDontRun',
  'downloadWhyHeading',
  'downloadWhySmartScreenTitle',
  'downloadWhySmartScreenBody',
  'downloadWhyAntivirusTitle',
  'downloadWhyAntivirusBody',
  'downloadWhySourceLink',
  'downloadUpdatesSuffix',
  'downloadPermissionRowLabel',
  'downloadPermissionOnLine',
  'downloadPermissionOffLine',
  'downloadStepPermissionRequirement',
  'downloadIncludedHeading',
  'downloadScreenLiveTitle',
  'downloadScreenLiveItem1',
  'downloadScreenLiveItem2',
  'downloadScreenLiveItem3',
  'downloadScreenLiveItem4',
  'downloadScreenLiveItem5',
  'downloadScreenInventoryTitle',
  'downloadScreenInventoryItem1',
  'downloadScreenInventoryItem2',
  'downloadScreenInventoryItem3',
  'downloadScreenInventoryItem4',
  'downloadScreenSettingsTitle',
  'downloadScreenSettingsItem1',
  'downloadScreenSettingsItem2',
  'downloadScreenSettingsItem3',
  'downloadScreenSettingsItem4',
  // Optimize build gains a target (2026-08-31): the same button now searches for sustained DPS
  // or for the rotation's gold rate. `optimizeModeLabel` names the Select that picks; the four
  // `optimizeBuildFarm*` strings are the farm target's own result and no-result lines, kept
  // separate from the DPS ones because the two are denominated in different units.
  'optimizeModeLabel',
  'optimizeBuildFarmResultLine',
  'optimizeBuildFarmKeptCurrent',
  'optimizeBuildFarmNoPool',
  'optimizeBuildFarmNoRate',
  // The respec advisor's honest framing (2026-08-31): `farmRespecBestFound` says the proposal is
  // the best build the search found and not proof that no better one exists, and it renders on
  // every result. That claim used to appear only inside `farmRespecBudgetExhausted`, whose
  // absence then read as a guarantee of optimality the search cannot make at any budget.
  'farmRespecBestFound',
  /**
   * The account-holdings section (2026-09-02) — the Account page's new headline figure for what
   * the whole account could sell, over three components: the inventory, the sellable heroes and
   * the bought skins heroes are wearing. Each component needs its own name, its own coverage
   * template and its own notice for the case where the planner cannot read it at all, which is why
   * the block is three near-parallel triples rather than one shared set.
   *
   * `accountHoldingsUnpriced` is shared by all three instead: the heroes and skins components list
   * what they hold, and an entry the market is listing nothing for is printed and marked rather
   * than dropped, so the coverage line above it can be read as WHICH one is missing.
   *
   * `accountHoldingsHeroesFloor` and `accountHoldingsSkinsWorn` are permanent on-screen sentences
   * rather than tooltips: each explains a figure readers routinely take for something it is not (a
   * hero quote knows only rarity; a skin stops counting the moment nobody wears it), and an
   * explanation nobody hovers is one nobody reads.
   *
   * `inventoryTotalsTitle` is REWORDED by the same feature, from "Market value" to a phrase naming
   * the inventory — the Account page now carries the larger figure that contains it, and an
   * unqualified "Market value" on the Inventory screen read as the account's whole worth. It is not
   * listed in `PROSE_EDITED_PATHS`: the key is already declared added above, and an added key's
   * value is unconstrained by the comparison.
   */
  'accountHoldingsTotal',
  'accountHoldingsPartial',
  'accountHoldingsCoverage',
  'accountHoldingsMissing',
  'accountHoldingsUnpriced',
  'accountHoldingsInventory',
  'accountHoldingsInventoryCoverage',
  'accountHoldingsInventoryWithheld',
  'accountHoldingsInventoryLink',
  'accountHoldingsHeroes',
  'accountHoldingsHeroesCoverage',
  'accountHoldingsHeroesWithheld',
  'accountHoldingsHeroesFloor',
  'accountHoldingsSkins',
  'accountHoldingsSkinsCoverage',
  'accountHoldingsSkinsWithheld',
  'accountHoldingsSkinsWorn',
  /**
   * The download page's screen list catches up with the app (2026-09-07). It advertised four
   * screens while the desktop app shipped seven: Farm and Account were added to the app and never
   * added here, and Heroes is new. The three new cards are numbered keys for the same reason the
   * original four are — an array diffs as one leaf path per element in the value comparisons but
   * as the bare key name in the key-name comparison, so one entry could not satisfy both.
   *
   * Heroes carries six items rather than the four or five its neighbours do because the screen
   * genuinely holds six separable readings of one hero, and folding two together would have
   * described a screen that does less than it does.
   *
   * The cards are ordered as the app's own tab strip orders them, so a reader who installs it
   * meets the screens in the sequence this page introduced them. Nothing ties the two together,
   * so that ordering is a fact about this file only.
   */
  'downloadScreenFarmTitle',
  'downloadScreenFarmItem1',
  'downloadScreenFarmItem2',
  'downloadScreenFarmItem3',
  'downloadScreenFarmItem4',
  'downloadScreenFarmItem5',
  'downloadScreenHeroesTitle',
  'downloadScreenHeroesItem1',
  'downloadScreenHeroesItem2',
  'downloadScreenHeroesItem3',
  'downloadScreenHeroesItem4',
  'downloadScreenHeroesItem5',
  'downloadScreenHeroesItem6',
  'downloadScreenAccountTitle',
  'downloadScreenAccountItem1',
  'downloadScreenAccountItem2',
  'downloadScreenAccountItem3',
  'downloadScreenAccountItem4',
  'downloadScreenAccountItem5',
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
/**
 * Paths reworded in pt-BR ONLY, declared separately because `PROSE_EDITED_PATHS` above is
 * checked against BOTH languages: a path listed there must differ from the fixture in `en` and
 * in `pt`, so a fix that is genuinely one language's own could not be declared at all without
 * inventing an English edit to match it.
 *
 * This does not loosen the comparison. `en` is still measured against `PROSE_EDITED_PATHS` alone
 * and `pt` against both lists, so an undeclared drift in either language still fails, and a path
 * put here rather than above is a claim — checked by the two assertions — that English did not
 * change.
 */
const PROSE_EDITED_PATHS_PT_ONLY: readonly string[] = [
  // The planner's pt-BR called a stat a "Stat" in the two places it names one as a heading —
  // the sheet/points column and the Effective panel's title — while every label under them was
  // translated. Both now say Atributo(s), matching the desktop's Heroes screen, and the pt
  // walkthrough paragraph that names the panel follows it. English calls a stat a stat.
  'colStat',
  'panelEffective',
];

const PROSE_EDITED_PATHS: readonly string[] = [
  // The Points table prints each figure in its own unit now (2026-09-10), so the four rate stats
  // no longer carry a `%` in their NAME: `Crit %` -> `Crit`, `Crit dmg +%` -> `Crit dmg`,
  // `Pen %` -> `Pen`, `CDR %` -> `CDR`, and their pt-BR counterparts. The sheet table and the
  // team-plan stat breakdown, whose rows show many unitless figures at once, append the unit to
  // the label themselves rather than to nine cells apiece.
  'statShort.critChance',
  'statShort.critDmg',
  'statShort.penetration',
  'statShort.cdr',
  // The planner's first tab (2026-09-09) was named for the only panel it held. It now carries the
  // hero's identity and birth roll as well, so it is named for the hero: `tabHero` Abilities ->
  // Hero. Its warning title moves with it — the badge reports a default sheet as well as unspent
  // ability points, so "Abilities need attention" under-reported it even before the rename.
  'tabHero',
  'tabHeroWarnTitle',
  // The abilities panel stopped printing a slot count, a granted/spendable split and a dead-point
  // total, so the tip's opening sentence — which explained the budget behind them — went with
  // them. What it still names is which abilities reach the hero's in-game stats.
  'abilitiesTip',
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
  // Optimize build gains a target (2026-08-31): the Tier 1 gain line now names sustained DPS as
  // the thing it measured, and points at the DPS setting of the button rather than the button.
  // With a farm target on the same control, an unqualified "possible gain" no longer says which.
  'resetAdviceGainLine',
  // The respec advisor's honest framing (2026-08-31): this line no longer carries the
  // "not guaranteed to be the best that exists" clause — `farmRespecBestFound` says that on every
  // result now — and no longer calls the bound a time budget, which it never was.
  'farmRespecBudgetExhausted',
  // The page is renamed Team plan -> Optimizer (2026-09-07), URL `/team-plan` -> `/optimizer`.
  // The nav label changes key as well and is declared above; these carry the page's own name in
  // their text. The explain section is retitled to match and its opening sentence no longer says
  // the search scores for DPS, which stopped being the only objective. `teamPlanFarmAdvisorPointer`
  // also names the page and is NOT listed here: it is already declared added above, and an added
  // key's value is unconstrained by the comparison.
  'teamPlanPageLandmark',
  'teamPlanPageTitle',
  'explainSections.8.h',
  'explainSections.8.p.0',
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

/**
 * Every namespace module, named — the name is what the duplicate-key failure prints, and a
 * bare module reference leaves it saying nothing about where the collision came from.
 *
 * A namespace missing here is not guarded at all: `inventory` was absent from this list from the
 * day it landed, so its keys could have shadowed another namespace's silently.
 */
const namespaces = [
  ['chrome', chrome],
  ['planner', planner],
  ['gear', gear],
  ['abilities', abilities],
  ['account', account],
  ['advice', advice],
  ['breakdown', breakdown],
  ['phases', phases],
  ['teamPlan', teamPlan],
  ['teamPlanGearFlow', teamPlanGearFlow],
  ['teamPlanObjective', teamPlanObjective],
  ['import', importNs],
  ['stats', stats],
  ['market', market],
  ['inventory', inventory],
  ['download', download],
] as const;

describe('i18n split parity', () => {
  // The fixture (apps/web/src/tests/fixtures/i18n-strings-main.json) is frozen
  // (docs/naming.md:74) between re-baselines (see the file-top comment for the 2026-08-17
  // one). Parity is measured against the fixture minus KEYS_REMOVED — every undeclared drift
  // stays fatal in both directions.
  it('STRINGS.en differs from the frozen fixture (minus declared-removed keys) at exactly the declared deltas', () => {
    const diffs = diffLeafPaths(STRINGS.en, omitKeys(fixture.en, KEYS_REMOVED)).sort();
    expect(diffs).toEqual([...PROSE_EDITED_PATHS, ...KEYS_ADDED].sort());
  });

  it('STRINGS.pt differs from the frozen fixture (minus declared-removed keys) at exactly the declared deltas', () => {
    const diffs = diffLeafPaths(STRINGS.pt, omitKeys(fixture.pt, KEYS_REMOVED)).sort();
    expect(diffs).toEqual(
      [...PROSE_EDITED_PATHS, ...PROSE_EDITED_PATHS_PT_ONLY, ...KEYS_ADDED].sort(),
    );
  });

  it('a pt-only declaration really is pt-only — English matches the fixture at every one', () => {
    const enDiffs = new Set(diffLeafPaths(STRINGS.en, omitKeys(fixture.en, KEYS_REMOVED)));
    for (const path of PROSE_EDITED_PATHS_PT_ONLY) {
      expect(enDiffs.has(path), `${path} is declared pt-only but English changed too`).toBe(false);
    }
  });

  it('namespace key sets are pairwise disjoint', () => {
    const seen = new Map<string, string>();
    for (const [name, ns] of namespaces) {
      for (const key of Object.keys(ns.en)) {
        const prior = seen.get(key);
        expect(prior, `duplicate key ${key}: in ${name} and already in ${prior}`).toBeUndefined();
        seen.set(key, name);
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
