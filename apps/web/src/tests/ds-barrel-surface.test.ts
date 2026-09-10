import { describe, it, expect } from 'vitest';
import * as DesignSystem from '@bombfarm/ui';
import * as GameArt from '@bombfarm/game-art';

// Frozen at T1.1 (pre-Phase-2 split) — every VALUE the design-system barrel
// exports today. Type-only exports are erased at runtime and are not part of
// this list; they are covered separately by ds-compound-namespaces.test.ts's
// compile-time assertion. A dropped or renamed value export while replacing a
// module with a directory fails this test.
// M2-icons: Icon, iconSources, isIconName added (UI-chrome only; no game glyphs).
// M2-shell-status (2026-08-11): StatusChip, EmptyState added — StatusChip is
// the single implementation of the game-connection states; EmptyState covers
// "no game / no items / no filter matches" placeholders. AppShell's export
// itself is unchanged (still a value export); only its props grew.
// M2-toast-settings (2026-08-11): toastQueueReducer, initialToastQueueState,
// nextExpiryDeadline, MAX_VISIBLE_TOASTS, NOTIFICATION_BUFFER_LIMIT (the pure
// toast queue), ToastProvider, useToast, ToastViewport, ToastItem (the new
// toast system — deliberately NOT named `Toast`, which stays the legacy
// export), NotificationCenter, Slider, SettingsSection, SettingsRow, SaveBar
// added. Legacy `Toast` is unchanged and stays byte-compatible for `apps/web`.
// DeltaTable (2026-08-20): the shared Stat/Now/Target/Change ledger table —
// replaces the Team Plan CSS-grid stand-in and the Farm Respec hero card's
// own inline `<table>`, added.
// PanelHeader (2026-08-26): the panelHClass/panelTitleClass header row + <h2>,
// promoted from five desktop call sites that hand-rolled the heading, added.
// AppNav / SegmentedToggle (2026-08-26): the web's segmented nav pill and PT/EN
// bordered toggle group, extracted so both apps share one implementation. AppShell's nav rail
// became a top bar built from AppNav; its own export is unchanged (still a value export).
// BrandMark (L5, desktop/web UI sync): the header mark's five shapes, inlined as a component
// instead of a binary asset both apps would need their own copy step for. AppShell gained an
// optional `brand` slot for it; the web's own header keeps its `<Image src="/favicon.svg">`.
// formatNumber / formatCompactNumber: the compact metric formatter, moved here from the web
// app so the desktop renderer can share the exact same implementation.
// Sparkline (2026-08-30): a trend line over a series of readings, sized by its container and
// toned by `currentColor`. Added for the Live tab's 10-minute gold trend; the planner's own
// history views are the obvious second caller.
// ActionChip (2026-08-31): StatusChip's pill as a control — same chipRecipe tones and dot, but a
// <button>. Added for the desktop footer's update indicator, which reports a state AND leads
// somewhere; StatusChip stays the non-interactive game-connection vocabulary.
// statListMutedRowClass (2026-08-31): promoted from the `panel-field.recipe` subpath, beside the
// other class constants already here. This package's `exports` map resolves a subpath to an
// extensionless source path, which an app's tsconfig `paths` completes but another package's own
// `tsc` cannot — so a shared component outside apps/web could not import it deeply.
// colClass / dialogDescClass / panelHClass / panelTitleClass / tipClass / the eight phasesBoard*
// classes (2026-08-31): promoted from the same subpath for the same reason. They lay out the
// phases explorer's panel grid, and the panels that draw it are `@bombfarm/farm`'s now.
// accountStatListClass / heroAbilTitleClass (2026-09-02): promoted from the same subpath for the
// same reason. They style the Account page's stat rows and its sub-headings, and the panels that
// draw them are `@bombfarm/account`'s now.
// Menu (2026-09-02): the compound wrap over Base UI's menu, dressed with the popup chrome Select
// already draws. Added for the desktop top bar's overflow button; the barrel had no popup control
// that lists commands, which is how one nearly got hand-rolled.
// useShellDensity / shellDensityFor / SHELL_ACTIONS_COLLAPSE_WIDTH / SHELL_BRAND_MARK_WIDTH /
// SHELL_ICON_TABS_WIDTH (2026-09-02, third width added 2026-09-07): the widths at which a top bar
// stops fitting, and the hook that reports which side of them the window is on. AppShell takes the
// answer as a prop rather than measuring, so the same value drives the tabs and whatever the
// caller puts in the actions slot.
// abilGridClass / abilHeadClass / abilMetaClass / abilNameClass / abilTagClass / abilEffectClass
// (2026-09-07): promoted from the `ability-card.recipe` subpath for the same reason as the class
// constants above. They lay out an ability card's icon rail, name, tag and effect text, and the
// hero abilities panel that draws them is `@bombfarm/hero`'s.
// mutedClass / warnClass / explainFormulaClass / the three optimizeGroup* classes (2026-09-07):
// promoted from the `panel-field.recipe` subpath for the same reason as the class constants
// above. They tone a panel's secondary and over-budget text, box a substituted formula, and weld
// the Optimize button to its target Select — and the sheet, points and stat-breakdown panels that
// draw them are `@bombfarm/hero`'s now.
// heroAbilHClass / maskRevealStyle (2026-09-07): promoted for the same reason as the class
// constants above. They lay out a sub-heading row and fade a collapsible's growing edge, and the
// Items panel and its loadout comparison, which draw both, are `@bombfarm/hero`'s now.
// barRowClass / rankModeSelectClass (2026-09-07): promoted for the same reason again. They lay out
// a labelled gain bar and size the mode select beside a panel heading, and the next-point ranking
// panel that draws them is `@bombfarm/hero`'s now.
// accordionStackClass / accordionLedgerBodyClass (2026-09-07): promoted from the
// `accordion.recipe` subpath, beside `accordionRecipe` which was already here. They space a
// stack of accordion rows and pad an opened one's body — the per-statistic breakdown the desktop
// Heroes screen now draws needs both, and that app imports the barrel, not deep paths.
const FROZEN_BARREL_VALUE_EXPORTS = [
  'AbilityCard',
  'Accordion',
  'ActionChip',
  'AppNav',
  'AppShell',
  'Bar',
  'Banner',
  'BrandMark',
  'Button',
  'Chip',
  'Collapsible',
  'ConfirmDialog',
  'DEFAULT_HUE',
  'DataTable',
  'DeltaTable',
  'Dialog',
  'EmptyState',
  'FieldRequired',
  'Fields',
  'FileDropZone',
  'GlossaryTerm',
  'GlossedText',
  'HelpTip',
  'Icon',
  'iconSources',
  'isIconName',
  'MAX_VISIBLE_TOASTS',
  'Menu',
  'MetricScoreboard',
  'NOTIFICATION_BUFFER_LIMIT',
  'NotificationCenter',
  'Num',
  'Panel',
  'PanelHeader',
  'RankControl',
  'SaveBar',
  'SegmentedToggle',
  'SHELL_ACTIONS_COLLAPSE_WIDTH',
  'SHELL_BRAND_MARK_WIDTH',
  'SHELL_ICON_TABS_WIDTH',
  'Select',
  // `SelectMultiple` (2026-08-27): its own component rather than a `multiple?: boolean` branch on
  // `Select` — the two disagree on the type of `value` and on what a change is, and a union that
  // loose pushes the narrowing onto every call site. Base UI's select does the work.
  'SelectMultiple',
  // `SearchSelect` / `searchSelectMatches` (2026-09-07): `Select`'s trigger and popup over a list
  // too long to scroll, with a search field in the popup and a rendered-row cap. Base UI's
  // combobox does the work; the matcher is exported beside it so a caller can test the query its
  // own labels answer to without mounting the control.
  'SearchSelect',
  'searchSelectMatches',
  'SettingsRow',
  'SettingsSection',
  'Slider',
  'SortableTableHeader',
  'Sparkline',
  'StatList',
  'StatusChip',
  'Stepper',
  'Switch',
  'TableScroller',
  'Tabs',
  'Toast',
  'ToastItem',
  'ToastProvider',
  'ToastViewport',
  'TipLabel',
  'Tooltip',
  'TooltipStatusBody',
  'WINDOW_CONTROLS_WIDTH',
  'WindowControls',
  'abilEffectClass',
  'abilGridClass',
  'abilHeadClass',
  'abilMetaClass',
  'abilNameClass',
  'abilTagClass',
  'abilityCardRecipe',
  'abilityChipRecipe',
  'accountStatListClass',
  'accordionRecipe',
  'accordionLedgerBodyClass',
  'accordionStackClass',
  'adviceSplitClass',
  'barRecipe',
  'barRowClass',
  'breakpoints',
  'buttonRecipe',
  'chipRecipe',
  'cn',
  'colClass',
  'colorTokens',
  'contrastPairs',
  'cssVariables',
  'dataTableCellRecipe',
  'dataTableClass',
  'dataTableHeadButtonClass',
  'dataTableHeadClass',
  'dialogDescClass',
  'explainFormulaClass',
  'fileDropZoneRecipe',
  'formatCompactNumber',
  'formatNumber',
  // The number formatters take the reader's language now, so the pair that binds one for the
  // components which receive an injected formatter ships beside them.
  'numberFormatterFor',
  'compactNumberFormatterFor',
  'heroAbilHClass',
  'heroAbilTitleClass',
  'initialToastQueueState',
  'maskRevealStyle',
  'metricScoreboardDeltaRecipe',
  'metricScoreboardValueRecipe',
  'motionTokens',
  'mutedClass',
  'nextExpiryDeadline',
  'optimizeGroupButtonClass',
  'optimizeGroupClass',
  'optimizeGroupSelectClass',
  'panelHClass',
  'panelRecipe',
  'panelTitleClass',
  'phasesBoardClass',
  'phasesBoardDropsClass',
  'phasesBoardEconomyClass',
  'phasesBoardJaulaClass',
  'phasesBoardMapClass',
  'phasesBoardPropsClass',
  'phasesBoardRosterClass',
  'phasesBoardRosterSpanClass',
  'rankModeSelectClass',
  'selectFieldRecipe',
  'setupBannerRecipe',
  'shellDensityFor',
  'sortableTableHeaderButtonClass',
  'statListMutedRowClass',
  'stickyHeadClass',
  'switchRootRecipe',
  'tipClass',
  'toastQueueReducer',
  'tokens',
  'tooltipPopupRecipe',
  'useShellDensity',
  'useToast',
  'warnClass',
].sort();

describe('design-system barrel surface (frozen)', () => {
  it('exports exactly the frozen value name set — no dropped or renamed export', () => {
    const actual = Object.keys(DesignSystem).sort();
    expect(actual).toEqual(FROZEN_BARREL_VALUE_EXPORTS);
  });
});

// adviceSplitClass (2026-09-09): it pairs the points table with the next-point ranking beside it,
// and the desktop's Heroes screen now stacks that pair the way the planner's Points tab does. Two
// shells draw it now, and the desktop renderer reads every layout class off this root rather than
// off the `panel-field.recipe` subpath.
//
// HeroIdentity (L4, desktop/web UI sync): the avatar+rank/name/rarity/level primitive extracted
// from HeroIdentityChip so a caller without a full HeroRecord (a live roster join, mid-flight)
// can render the same identity block. HeroIdentityChip stays as a thin HeroRecord adapter over it.
//
// InventoryGrid (2026-08-26): the inventory surface both shells render. It lives here rather than
// in @bombfarm/ui because it composes ItemIcon and the rarity classes, which are game vocabulary;
// it carries no strings of its own, so each shell supplies its own locale.
//
// The toolbar and stat classes (2026-08-27): the grid grew a search-and-filter toolbar and
// per-kind cards. `ItemIcon` absorbed the inventory'''s own icon rather than keeping a sibling —
// it lays the game'''s rarity slot plate under every item tile the app draws, and takes a
// structural shape both `EquippedItem` and `InventoryViewItem` satisfy.
//
// The toolbar and stat-panel classes (2026-08-27) are exported for the same reason every other
// recipe here is: both shells render the grid, and a shell that wants to match its chrome needs
// the tokens rather than a copy of the class strings.
//
// SpriteLoop: the preloading, reduced-motion-aware pixel-art frame loop generalised out of the
// web-only hero6 bomb-activation sprite, so the desktop app can reuse the same implementation.
// The market price and table exports (2026-08-29): the inventory grew a second layout, and both
// shells render it beside the cards. `MarketPrice` is the one place a Steam price is drawn, so
// the card and the table cannot drift apart on how an approximate figure or a missing listing
// reads; `nextInventorySort` is the header buttons' pure fold over the domain's multi-term sort,
// exported so a host driving the table from its own toolbar produces the same order.
//
// `inventoryFieldHeightClass` (2026-09-05): the toolbar field height on its own, for a control
// that brings its own chrome — a design-system `Select` — and needs only to stand the same height
// as the fields beside it. Split out of `inventoryFieldClass` so a second toolbar cannot reach
// for a number of its own and drift a pixel from this one.
//
// `ItemIdentity` (2026-09-05): icon, name and forge level on one line, tier and level on the
// next — the one arrangement every surface that names an item now uses. The inventory card, the
// inventory row and the Forge screen each had their own before, and the level itself was written
// three different ways; added so a fourth surface cannot invent a fifth.
//
// The table's per-host column set (2026-09-05): `DEFAULT_INVENTORY_TABLE_COLUMNS` is the set an
// inventory bag asks for, named so a second host can start from it. `inventoryTableNameClass`,
// `inventoryTableItemNameClass` and `inventoryTableForgeClass` left with it — `ItemIdentity` now
// draws that whole block, and the three had no callers once it did.
// `inventoryTableSelectedRowClass` arrives in their place, for the row a picker screen is
// currently planning against.
//
// The four gear-slot classes (2026-09-07): the eight-across slot grid, the stats grid under it, one
// stat row, and the chrome of one stat box. They live here rather than in `@bombfarm/ui` because
// `slotStatClassName` composes `artFrameRadiusClass`, which is this package's and which the design
// system cannot import — the dependency runs this way — and because the `inventory*` family beside
// them is the same item-tile vocabulary. The Items panel that draws them is `@bombfarm/hero`'s now.
const FROZEN_GAME_ART_BARREL_VALUE_EXPORTS = [
  'AbilityIcon',
  'ArtFrame',
  'DEFAULT_INVENTORY_TABLE_COLUMNS',
  'InventoryGrid',
  'InventoryLayoutToggle',
  'InventoryTable',
  'InventoryToolbar',
  'InventoryTotals',
  'MAX_HERO_STARS',
  'MarketPrice',
  'nextInventorySort',
  'ChestIcon',
  'ClockIcon',
  'DropIcon',
  'GoldIcon',
  'GoldValue',
  'HeroAbilityIcons',
  'HeroAvatar',
  'HeroGearIcons',
  'HeroIdentity',
  'HeroIdentityChip',
  'HouseIcon',
  'ItemIcon',
  'ItemIdentity',
  'PropIcon',
  'SpriteLoop',
  'abilityIconRecipe',
  'artFrameRadiusClass',
  'artFrameRecipe',
  'heroRankBandClass',
  'heroRankTextClass',
  'heroRankToneClass',
  'iconMetaGlyphRecipe',
  'inventoryBadgeRecipe',
  'inventoryCardRecipe',
  'inventoryChipRecipe',
  'inventoryCountClass',
  'inventoryCountValueClass',
  'inventoryFieldClass',
  'inventoryFieldHeightClass',
  'inventoryFooterClass',
  'inventoryGridClass',
  'inventorySortDirectionClass',
  'inventorySortGroupClass',
  'inventorySortSelectClass',
  'inventoryStatLabelClass',
  'inventoryStatLeaderClass',
  'inventoryStatRowClass',
  'inventoryStatValueClass',
  'inventoryStatsPanelClass',
  'inventoryTableActionButtonClass',
  'inventoryTableBlankClass',
  'inventoryTableGoldClass',
  'inventoryTableGroupCountClass',
  'inventoryTableGroupHeaderClass',
  'inventoryTableHeroClass',
  'inventoryTableHeroNameClass',
  'inventoryTableResultCountClass',
  'inventoryTableRowClass',
  'inventoryTableSelectedRowClass',
  'inventoryTableSkippedNoteClass',
  'inventoryTableToolbarClass',
  'rarityDotClass',
  'rarityTextClass',
  'rosterIconTooltipTriggerClass',
  'rosterInactiveChromeClass',
  'slotStatClassName',
  'slotStatRowClass',
  'slotStatsGridClass',
  'slotsGridClass',
].sort();

describe('game-art barrel surface (frozen)', () => {
  it('exports exactly the frozen value name set — no dropped or renamed export', () => {
    const actual = Object.keys(GameArt).sort();
    expect(actual).toEqual(FROZEN_GAME_ART_BARREL_VALUE_EXPORTS);
  });
});
