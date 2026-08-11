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
  'MetricScoreboard',
  'Num',
  'Panel',
  'RankControl',
  'Select',
  'SortableTableHeader',
  'StatList',
  'StatusChip',
  'Stepper',
  'Switch',
  'TableScroller',
  'Tabs',
  'Toast',
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
  'metricScoreboardDeltaRecipe',
  'metricScoreboardValueRecipe',
  'motionTokens',
  'panelRecipe',
  'selectFieldRecipe',
  'setupBannerRecipe',
  'sortableTableHeaderButtonClass',
  'stickyHeadClass',
  'switchRootRecipe',
  'tokens',
  'tooltipPopupRecipe',
].sort();

describe('design-system barrel surface (frozen)', () => {
  it('exports exactly the frozen value name set — no dropped or renamed export', () => {
    const actual = Object.keys(DesignSystem).sort();
    expect(actual).toEqual(FROZEN_BARREL_VALUE_EXPORTS);
  });
});
