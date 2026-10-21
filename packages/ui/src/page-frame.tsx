import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';
import { pageFrameBodyClass, pageFrameClass, pageSectionSettingsClass } from './page-frame.recipe';
import { workspaceClass, workspaceShellClass } from './panel-field.recipe';

export interface PageFrameProps {
  header?: ReactNode;
  /** Banners and dialogs that sit between the header and the body. */
  notices?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Rendered last, after the footer: toasts and anything else that must outlive the body. */
  overlays?: ReactNode;
  className?: string;
}

export function PageFrame({ header, notices, children, footer, overlays, className }: PageFrameProps) {
  return (
    <div className={cn(pageFrameClass, className)}>
      {header}
      {notices}
      <div className={cn(workspaceShellClass, pageFrameBodyClass)}>{children}</div>
      {footer}
      {overlays}
    </div>
  );
}

export type PageSectionProps = ComponentPropsWithoutRef<'div'> & {
  /** `settings` narrows the section to the settings measure; the default is the full app measure. */
  measure?: 'default' | 'settings';
};

export function PageSection({ measure = 'default', className, ...props }: PageSectionProps) {
  return (
    <div
      className={cn(measure === 'settings' ? pageSectionSettingsClass : workspaceClass, className)}
      {...props}
    />
  );
}
