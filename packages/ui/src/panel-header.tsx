import type { ReactNode } from 'react';
import { panelHClass, panelTitleClass } from './panel-field.recipe';
import { cn } from './cn';

export type PanelHeaderProps = {
  title: string;
  /** An `InfoTip` drawn right after the title, in place of an intro paragraph under it. */
  info?: ReactNode;
  /** Right-hand side of the header row — counters, actions, a rank-mode select. */
  children?: ReactNode;
  className?: string;
};

export function PanelHeader({ title, info, children, className }: PanelHeaderProps) {
  const heading = <h2 className={panelTitleClass}>{title}</h2>;
  return (
    <div className={cn(panelHClass, className)}>
      {info === undefined ? (
        heading
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          {heading}
          {info}
        </div>
      )}
      {children}
    </div>
  );
}
