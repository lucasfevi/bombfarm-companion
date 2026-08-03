import { describe, it, expect } from 'vitest';
import * as DesignSystem from '@bombfarm/ui';

// Frozen at T1.1 (pre-Phase-2 split) — every VALUE the design-system barrel
// exports today. Type-only exports are erased at runtime and are not part of
// this list; they are covered separately by ds-compound-namespaces.test.ts's
// compile-time assertion. A dropped or renamed value export while replacing a
// module with a directory (ASM-03) fails this test (MOD-28, W6-01).
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
  'DataTable',
  'Dialog',
  'FieldRequired',
  'Fields',
  'FileDropZone',
  'GlossaryTerm',
  'GlossedText',
  'HelpTip',
  'MetricScoreboard',
  'Num',
  'Panel',
  'RankControl',
  'Select',
  'SortableTableHeader',
  'StatList',
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
  'buttonRecipe',
  'chipRecipe',
  'cn',
  'cssVariables',
  'dataTableCellRecipe',
  'dataTableClass',
  'dataTableHeadButtonClass',
  'dataTableHeadClass',
  'fileDropZoneRecipe',
  'metricScoreboardDeltaRecipe',
  'metricScoreboardValueRecipe',
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
