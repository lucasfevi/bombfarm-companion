import type { ReactNode } from 'react';
import { appNavItemRecipe, appNavRootClass } from './app-nav.recipe';
import { cn } from './cn';
import { Icon, type IconName } from './icon';
import { Tooltip } from './tooltip';

export interface AppNavItem {
  id: string;
  label: string;
  active: boolean;
  /** Drawn in place of the label once `compact` is set. An item without one keeps its words. */
  icon?: IconName;
}

export interface AppNavProps {
  items: ReadonlyArray<AppNavItem>;
  /** Defaults to `'Main'` — the desktop smoke suite locates this landmark by that name. */
  ariaLabel?: string;
  onSelect?: ((id: string) => void) | undefined;
  /** Lets the web supply a Next `<Link>` in place of the default `<button type="button">`. */
  renderItem?: (item: AppNavItem, className: string) => ReactNode;
  /**
   * Glyphs in place of words, for a bar too narrow to spell every tab. The active item keeps its
   * label either way, so the screen the player is on is still named rather than left to a glyph.
   */
  compact?: boolean;
  className?: string;
}

/**
 * AppNav — the segmented nav pill shared by the web's site header and the desktop's `AppShell`.
 * Renders nothing when `items` is empty, so a consent-gated desktop screen mounts no `<nav>` at
 * all (matches `AppShell`'s pre-existing behavior).
 */
export function AppNav({
  items,
  ariaLabel = 'Main',
  onSelect,
  renderItem,
  compact = false,
  className,
}: AppNavProps) {
  if (items.length === 0) return null;

  const nav = (
    <nav aria-label={ariaLabel} className={cn(appNavRootClass, className)}>
      {items.map((item) => {
        const glyph = compact ? item.icon : undefined;
        const iconOnly = glyph !== undefined && !item.active;
        const itemClassName = appNavItemRecipe({
          active: item.active,
          layout: glyph === undefined ? 'label' : iconOnly ? 'icon' : 'icon-and-label',
        });
        if (renderItem) return renderItem(item, itemClassName);

        const button = (
          <button
            key={item.id}
            type="button"
            aria-current={item.active ? 'page' : undefined}
            aria-label={iconOnly ? item.label : undefined}
            onClick={() => onSelect?.(item.id)}
            className={itemClassName}
          >
            {glyph ? <Icon name={glyph} size="sm" /> : null}
            {iconOnly ? null : item.label}
          </button>
        );

        if (!iconOnly) return button;
        return (
          <Tooltip.Root key={item.id}>
            <Tooltip.Trigger render={button} />
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0">{item.label}</p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </nav>
  );

  if (!compact) return nav;
  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      {nav}
    </Tooltip.Provider>
  );
}
