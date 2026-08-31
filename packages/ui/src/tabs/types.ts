import type { ReactNode } from 'react';
import type { MotionStyle, Transition } from 'motion/react';

export type TabsRootProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
};

export type TabsListProps = {
  className?: string;
  children: ReactNode;
};

export type TabsTabProps = {
  value: string;
  className?: string;
  children: ReactNode;
  badge?: 'warn' | 'soft' | null;
  /** Short visible status next to the tab name (e.g. "off"). Prefer tooltips for explanations. */
  badgeLabel?: string | null;
  /** Hover/focus status tip — title + issues; shown when `badge` is set. */
  status?: { title: string; issues: readonly string[] } | null;
  'aria-label'?: string;
};

export type TabsPanelsProps = {
  className?: string;
  children: ReactNode;
  transition?: Transition;
};

export type TabsPanelProps = {
  value: string;
  className?: string;
  children: ReactNode;
  style?: MotionStyle | undefined;
};
