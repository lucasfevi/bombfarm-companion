import { CollapsibleRoot } from './collapsible-root';
import { CollapsibleTrigger } from './collapsible-trigger';
import { CollapsiblePanel } from './collapsible-panel';

export type {
  CollapsibleRootProps,
  CollapsibleTriggerProps,
  CollapsiblePanelProps,
} from './types';

/**
 * Collapsible primitive — compound wrap over `@base-ui/react/collapsible`
 * (UAC-02). Single disclosure; shares the trigger recipe + chevron with
 * `Accordion`.
 */
export const Collapsible = { Root: CollapsibleRoot, Trigger: CollapsibleTrigger, Panel: CollapsiblePanel };
