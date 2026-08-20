import { describe, it, expect } from 'vitest';
import * as DesignSystem from '@bombfarm/ui';

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
const FROZEN_BARREL_VALUE_EXPORTS = [
  'AbilityCard',
  'Accordion',
  'AppShell',
  'Bar',
  'Banner',
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
  'RankControl',
  'SaveBar',
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
