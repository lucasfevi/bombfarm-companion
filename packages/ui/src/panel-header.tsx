import type { ReactNode } from 'react';
import { panelHClass, panelTitleClass } from './panel-field.recipe';
import { cn } from './cn';

export type PanelHeaderProps = {
  title: string;
  /** Right-hand side of the header row — counters, actions, a rank-mode select. */
  children?: ReactNode;
  className?: string;
};

export function PanelHeader({ title, children, className }: PanelHeaderProps) {
  return (
    <div className={cn(panelHClass, className)}>
      <h2 className={panelTitleClass}>{title}</h2>
      {children}
    </div>
  );
}
