/**
 * Planner tabs — adapted from Animate UI animate/tabs
 * https://animate-ui.com/docs/primitives/animate/tabs
 * (horizontal slide + auto-height + inactive fade + spring highlight).
 * Inactive panes are opacity-faded only — CSS filter blur bleeds past overflow:clip.
 * Dressed for our tokens; keeps the compound `Tabs.Root/List/Tab/Panels/Panel` API.
 */

import { TabsRoot } from './tabs-root';
import { TabsList } from './tabs-list';
import { TabsTab } from './tabs-tab';
import { TabsPanels } from './tabs-panels';
import { TabsPanel } from './tabs-panel';

export type {
  TabsRootProps,
  TabsListProps,
  TabsTabProps,
  TabsPanelsProps,
  TabsPanelProps,
} from './types';

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Panels: TabsPanels,
  Panel: TabsPanel,
};
