import type { ReactNode } from 'react';
import { appNavItemRecipe, appNavRootClass } from './app-nav.recipe';
import { cn } from './cn';

export interface AppNavItem {
  id: string;
  label: string;
  active: boolean;
}

export interface AppNavProps {
  items: ReadonlyArray<AppNavItem>;
  /** Defaults to `'Main'` — the desktop smoke suite locates this landmark by that name. */
  ariaLabel?: string;
  onSelect?: (id: string) => void;
  /** Lets the web supply a Next `<Link>` in place of the default `<button type="button">`. */
  renderItem?: (item: AppNavItem, className: string) => ReactNode;
  className?: string;
}

/**
 * AppNav — the segmented nav pill shared by the web's site header and the desktop's `AppShell`.
 * Renders nothing when `items` is empty, so a consent-gated desktop screen mounts no `<nav>` at
 * all (matches `AppShell`'s pre-existing SHL-04 behavior).
 */
export function AppNav({ items, ariaLabel = 'Main', onSelect, renderItem, className }: AppNavProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={cn(appNavRootClass, className)}>
      {items.map((item) => {
        const itemClassName = appNavItemRecipe({ active: item.active });
        if (renderItem) return renderItem(item, itemClassName);
        return (
          <button
            key={item.id}
            type="button"
            aria-current={item.active ? 'page' : undefined}
            onClick={() => onSelect?.(item.id)}
            className={itemClassName}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
