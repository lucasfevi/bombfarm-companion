import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { buttonRecipe } from '../button.recipe';
import { cn } from '../cn';
import { Icon } from '../icon';
import {
  detailsMenuItemStateClass,
  detailsMenuPanelPositionClass,
  detailsMenuRootClass,
  detailsMenuSummaryClass,
  menuGroupLabelClass,
  menuItemClass,
  menuPopupClass,
  menuPositionerClass,
  menuSeparatorClass,
} from '../menu.recipe';

export interface DetailsMenuProps extends Omit<ComponentProps<'details'>, 'children'> {
  /** Names the trigger for assistive technology; the glyph alone says nothing. */
  label: string;
  /** Drawn inside the trigger. Defaults to the horizontal ellipsis. */
  trigger?: ReactNode;
  children: ReactNode;
}

/**
 * A menu built on the native disclosure element, so it opens and closes with JavaScript off. It
 * wears the `Menu` popup chrome; it has no roving focus, typeahead or outside-press dismissal,
 * which only a script can add.
 */
export function DetailsMenuRoot({ label, trigger, children, className, ...props }: DetailsMenuProps) {
  return (
    <details className={cn(detailsMenuRootClass, className)} {...props}>
      <summary
        aria-label={label}
        className={cn(buttonRecipe({ variant: 'default' }), detailsMenuSummaryClass)}
      >
        {trigger ?? <Icon name="ellipsis-horizontal" size="sm" />}
      </summary>
      <div className={cn(menuPositionerClass, detailsMenuPanelPositionClass)}>
        <div data-slot="menu-popup" className={menuPopupClass}>
          {children}
        </div>
      </div>
    </details>
  );
}

export interface DetailsMenuItemProps extends ComponentProps<'button'> {
  /** A link (or any element) to dress as an item in place of the default button. */
  render?: ReactElement<{ className?: string }>;
}

export function DetailsMenuItem({ render, className, children, ...props }: DetailsMenuItemProps) {
  const itemClass = cn(menuItemClass, detailsMenuItemStateClass, className);
  if (render) {
    return cloneElement(render, { ...props, className: cn(itemClass, render.props.className) }, children);
  }
  return (
    <button type="button" className={itemClass} {...props}>
      {children}
    </button>
  );
}

export function DetailsMenuSeparator({ className, ...props }: ComponentProps<'div'>) {
  return <div role="separator" className={cn(menuSeparatorClass, className)} {...props} />;
}

export function DetailsMenuGroupLabel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(menuGroupLabelClass, className)} {...props} />;
}
