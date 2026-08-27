import { describe, it, expect } from 'vitest';
import * as DesignSystem from '@bombfarm/ui';
import * as GameArt from '@bombfarm/game-art';

// Frozen at T1.1 (pre-Phase-2 split) — every VALUE the design-system barrel
// exports today. Type-only exports are erased at runtime and are not part of
// this list; they are covered separately by ds-compound-namespaces.test.ts's
// compile-time assertion. A dropped or renamed value export while replacing a
// module with a directory (ASM-03) fails this test (MOD-28, W6-01).
// M2-icons: Icon, iconSources, isIconName added (UI-chrome only; no game glyphs).
// M2-shell-status (2026-08-11): StatusChip, EmptyState added — StatusChip is
// the single implementation of INV-1 connection states; EmptyState covers
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
const FROZEN_BARREL_VALUE_EXPORTS = [
  'AbilityCard',
  'Accordion',
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
  'MetricScoreboard',
  'NOTIFICATION_BUFFER_LIMIT',
  'NotificationCenter',
  'Num',
  'Panel',
  'PanelHeader',
  'RankControl',
  'SaveBar',
  'SegmentedToggle',
  'Select',
  'SettingsRow',
  'SettingsSection',
  'Slider',
  'SortableTableHeader',
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
  'abilityCardRecipe',
  'abilityChipRecipe',
  'accordionRecipe',
  'barRecipe',
  'breakpoints',
  'buttonRecipe',
  'chipRecipe',
  'cn',
  'colorTokens',
  'contrastPairs',
  'cssVariables',
  'dataTableCellRecipe',
  'dataTableClass',
  'dataTableHeadButtonClass',
  'dataTableHeadClass',
  'fileDropZoneRecipe',
  'initialToastQueueState',
  'metricScoreboardDeltaRecipe',
  'metricScoreboardValueRecipe',
  'motionTokens',
  'nextExpiryDeadline',
  'panelRecipe',
  'selectFieldRecipe',
  'setupBannerRecipe',
  'sortableTableHeaderButtonClass',
  'stickyHeadClass',
  'switchRootRecipe',
  'toastQueueReducer',
  'tokens',
  'tooltipPopupRecipe',
  'useToast',
].sort();

describe('design-system barrel surface (frozen)', () => {
  it('exports exactly the frozen value name set — no dropped or renamed export', () => {
    const actual = Object.keys(DesignSystem).sort();
    expect(actual).toEqual(FROZEN_BARREL_VALUE_EXPORTS);
  });
});

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
const FROZEN_GAME_ART_BARREL_VALUE_EXPORTS = [
  'AbilityIcon',
  'ArtFrame',
  'InventoryGrid',
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
  'PropIcon',
  'abilityIconRecipe',
  'artFrameRadiusClass',
  'artFrameRecipe',
  'iconMetaGlyphRecipe',
  'inventoryBadgeRecipe',
  'inventoryCardRecipe',
  'inventoryChipRecipe',
  'inventoryCountClass',
  'inventoryCountValueClass',
  'inventoryFieldClass',
  'inventoryGridClass',
  'inventorySortDirectionClass',
  'inventorySortGroupClass',
  'inventorySortSelectClass',
  'inventoryStatLabelClass',
  'inventoryStatLeaderClass',
  'inventoryStatRowClass',
  'inventoryStatValueClass',
  'inventoryStatsPanelClass',
  'rarityDotClass',
  'rarityTextClass',
  'rosterIconTooltipTriggerClass',
  'rosterInactiveChromeClass',
].sort();

describe('game-art barrel surface (frozen)', () => {
  it('exports exactly the frozen value name set — no dropped or renamed export', () => {
    const actual = Object.keys(GameArt).sort();
    expect(actual).toEqual(FROZEN_GAME_ART_BARREL_VALUE_EXPORTS);
  });
});
