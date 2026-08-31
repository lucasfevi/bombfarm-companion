/**
 * `@bombfarm/farm/components` — the farm screen's React views.
 *
 * Every component here is prop-driven: none reads a store, a router or a host module, and none
 * carries copy of its own beyond `@bombfarm/farm/copy`. A host renders {@link FarmRankingBoardView}
 * and {@link PhasesExplorerView} from connectors that do their own state reads and pass the bags
 * down. Where a behaviour is genuinely the host's — routing, the edit-target switch, persisting a
 * hero's enable/disable — it arrives as a callback or a slot rather than being reimplemented here.
 */
export { FarmRankingBoardView } from './farm-ranking-board';
export type {
  FarmRankingBoardActions,
  FarmRankingBoardData,
  FarmRespecBoardData,
} from './farm-ranking-board';
export type { FarmStatLabels } from './stat-labels';
export { FarmCopyProvider, useFarmCopy } from './farm-copy-context';
export type { FarmCopyValue } from './farm-copy-context';
export { PhasesExplorerView } from './phases-explorer';
export type {
  PhasesExplorerActions,
  PhasesExplorerData,
  PhasesExplorerSlots,
} from './phases-explorer';
export { PhasesHeroSwitcherView } from './phases-hero-switcher';
export type { HeroPickerSlot, HeroPickerSlotProps } from './phases-hero-switcher';
export { HeroPickerDialogView } from './hero-picker/hero-picker-dialog';
export type { HeroPickerActions, HeroPickerData } from './hero-picker/hero-picker-dialog';
export { HeroActiveToggle } from './hero-picker/hero-active-toggle';
