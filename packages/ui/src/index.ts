/**
 * Design-system public entry.
 *
 * The single import surface for the UI primitives + `cn()`. Primitives wrap
 * `@base-ui/react` where an interactive equivalent exists and encode the
 * current look via cva recipes.
 *
 * Boundary rule: nothing under `ui/` (including this barrel and its transitive
 * imports) may import from planner feature folders (`panels/`, `roster/`,
 * `gear/`, `hero-planner/`, `lib/model`, …). Edges point out of `ui/` into
 * features, never back in.
 *
 * The cva recipe functions + variant types are exported for the few call sites
 * that dress a non-primitive element (e.g. a Ko-fi `<a>`, a Base UI
 * `Dialog.Close`). The fixed layout bundles (documented recipe constants)
 * are intentionally NOT re-exported here — import them from the matching
 * `*.recipe.ts` module inside this boundary.
 */

export {
  Icon,
  iconSources,
  isIconName,
  type IconName,
  type IconProps,
  type IconSize,
} from './icon';
export { cn } from './cn';
export {
  formatNumber,
  formatCompactNumber,
  numberFormatterFor,
  compactNumberFormatterFor,
  type BoundNumberFormat,
  type Lang,
} from './format-number';
export { AppShell } from './AppShell';
export type { AppShellProps, AppShellNavItem } from './AppShell';
export { BrandMark } from './brand-mark';
export type { BrandMarkProps } from './brand-mark';
export { AppNav } from './app-nav';
export type { AppNavItem, AppNavProps } from './app-nav';
export { SegmentedToggle } from './segmented-toggle';
export type { SegmentedToggleOption, SegmentedToggleProps } from './segmented-toggle';
export { StatusChip, type StatusChipProps, type GameConnectionStatus } from './status-chip';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { cssVariables, tokens, colorTokens, breakpoints, motionTokens, contrastPairs, DEFAULT_HUE } from './tokens';
export type { ColorTokenKey, ContrastPair } from './tokens';

export { Button, type ButtonProps } from './button';
export { Chip, type ChipProps } from './chip';
export { Stepper, type StepperProps } from './stepper';
export { RankControl } from './rank-control';
export { AbilityCard, type AbilityCardProps } from './ability-card';
export { Panel, type PanelProps } from './panel';
export { PanelHeader, type PanelHeaderProps } from './panel-header';
export { Fields, type FieldsProps, type FieldsLayout } from './fields';
export { Bar, type BarProps } from './bar';
export { Num } from './num';
export {
  Select,
  SelectMultiple,
  type SelectProps,
  type SelectMultipleProps,
  type SelectMultipleHeader,
} from './select';
export { Switch, type SwitchProps } from './switch';
export { Accordion } from './accordion';
export type {
  AccordionRootProps,
  AccordionItemProps,
  AccordionHeaderProps,
  AccordionTriggerProps,
  AccordionPanelProps,
} from './accordion';
export { Collapsible } from './collapsible';
export type {
  CollapsibleRootProps,
  CollapsibleTriggerProps,
  CollapsiblePanelProps,
} from './collapsible';
export { Tabs } from './tabs';
export type {
  TabsRootProps,
  TabsListProps,
  TabsTabProps,
  TabsPanelsProps,
  TabsPanelProps,
} from './tabs';
export { FieldRequired, type FieldRequiredProps } from './field-required';
export { HelpTip, type HelpTipProps } from './help-tip';
export { GlossaryTerm, type GlossaryTermProps } from './glossary-term';
export { Tooltip, TooltipStatusBody } from './tooltip';
export type {
  TooltipProviderProps,
  TooltipRootProps,
  TooltipTriggerProps,
  TooltipPortalProps,
  TooltipPositionerProps,
  TooltipPopupProps,
  TooltipArrowProps,
} from './tooltip';
export { tooltipPopupRecipe, type TooltipTone } from './tooltip.recipe';
export {
  DataTable,
  TableScroller,
  stickyHeadClass,
  SortableTableHeader,
  type DataTableRootProps,
  type DataTableHeaderProps,
  type DataTableCellProps,
  type TableScrollerProps,
  type SortableTableHeaderProps,
  type SortDir,
  type SortDir as SortableTableDir,
} from './data-table';
export {
  dataTableClass,
  dataTableHeadClass,
  dataTableHeadButtonClass,
  dataTableCellRecipe,
  sortableTableHeaderButtonClass,
} from './data-table.recipe';
export { StatList, type StatListItem } from './stat-list';
export { TipLabel, type TipLabelProps } from './stat-list-tip-label';
export {
  MetricScoreboard,
  type MetricScoreboardCell,
  type MetricScoreboardProps,
} from './metric-scoreboard';
export {
  DeltaTable,
  type DeltaTableRow,
  type DeltaTableColumnLabels,
  type DeltaTableProps,
} from './delta-table';
export { Toast } from './toast';
export {
  toastQueueReducer,
  initialToastQueueState,
  nextExpiryDeadline,
  MAX_VISIBLE_TOASTS,
  NOTIFICATION_BUFFER_LIMIT,
  type ToastVariant,
  type ToastActionButton,
  type ToastInput,
  type ToastEntry,
  type NotificationEntry,
  type ToastQueueState,
  type ToastQueueAction,
} from './toast-queue';
export {
  ToastProvider,
  useToast,
  ToastViewport,
  ToastItem,
  type ToastContextValue,
  type ToastProviderProps,
  type ToastItemProps,
} from './toast-system';
export {
  NotificationCenter,
  type NotificationCenterItem,
  type NotificationCenterProps,
} from './notification-center';
export { Slider, type SliderProps } from './slider';
export {
  SettingsSection,
  SettingsRow,
  SaveBar,
  type SettingsSectionProps,
  type SettingsRowProps,
  type SaveBarProps,
} from './settings-form';
export { GlossedText, type GlossedTextProps } from './glossed-text';
export { FileDropZone, type FileDropZoneProps } from './file-drop-zone';
export { fileDropZoneRecipe } from './file-drop-zone.recipe';
export { Banner, type BannerProps } from './banner';
export { Dialog } from './dialog';
export { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';

export { buttonRecipe, type ButtonVariant } from './button.recipe';
export { chipRecipe, type ChipVariant } from './chip.recipe';
export { barRecipe, type BarVariant } from './bar.recipe';
export {
  metricScoreboardValueRecipe,
  metricScoreboardDeltaRecipe,
} from './metric-scoreboard.recipe';
export { panelRecipe, setupBannerRecipe, type PanelVariant, type SetupBannerVariant } from './panel-field.recipe';
export {
  abilityCardRecipe,
  abilityChipRecipe,
  type AbilityChipVariant,
} from './ability-card.recipe';
export { selectFieldRecipe, type SelectSize } from './select.recipe';
export { switchRootRecipe, type SwitchSize } from './switch.recipe';
export { accordionRecipe, type AccordionVariant } from './accordion.recipe';
