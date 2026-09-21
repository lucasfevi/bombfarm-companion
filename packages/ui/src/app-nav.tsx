import type { ReactNode } from 'react';
import { appNavItemRecipe, appNavRootClass } from './app-nav.recipe';
import { cn } from './cn';
import { Icon, type IconName } from './icon';
import { Tooltip } from './tooltip';

/**
 * A small dot at an item's bottom-right corner that says how a live thing behind that screen is
 * doing — the desktop's Live tab wears the game connection this way. Colour is the state; the
 * words are the tooltip, so nothing rests on colour alone.
 */
export interface AppNavItemMark {
  tone: 'up' | 'warn' | 'muted';
  /** One line naming the state; the tooltip's first line. */
  label: string;
  /** An optional second line — the reason, an age. */
  detail?: string | undefined;
}

export interface AppNavItem {
  id: string;
  label: string;
  active: boolean;
  /** Drawn in place of the label once `compact` is set. An item without one keeps its words. */
  icon?: IconName;
  mark?: AppNavItemMark | undefined;
}

const MARK_TONE_CLASS: Record<AppNavItemMark['tone'], string> = {
  up: 'bg-up',
  warn: 'bg-warn',
  muted: 'bg-muted',
};

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
        const itemClassName = cn(
          appNavItemRecipe({
            active: item.active,
            layout: glyph === undefined ? 'label' : iconOnly ? 'icon' : 'icon-and-label',
          }),
          item.mark && 'relative',
        );
        if (renderItem) return renderItem(item, itemClassName);

        const button = (
          <button
            key={item.id}
            type="button"
            aria-current={item.active ? 'page' : undefined}
            aria-label={iconOnly ? item.label : undefined}
            data-mark={item.mark?.tone}
            onClick={() => onSelect?.(item.id)}
            className={itemClassName}
          >
            {glyph ? <Icon name={glyph} size="sm" /> : null}
            {iconOnly ? null : item.label}
            {item.mark ? (
              <span
                aria-hidden
                data-testid={`nav-mark-${item.id}`}
                className={cn('absolute', 'right-1', 'bottom-1', 'size-1.5', 'rounded-full', 'ring-2', 'ring-surface', MARK_TONE_CLASS[item.mark.tone])}
              />
            ) : null}
          </button>
        );

        // The tooltip names a glyph-only tab, says what a marked tab's dot means, or both.
        const tipLines = [...(iconOnly ? [item.label] : []), ...(item.mark ? [item.mark.label, ...(item.mark.detail ? [item.mark.detail] : [])] : [])];
        if (tipLines.length === 0) return button;
        return (
          <Tooltip.Root key={item.id}>
            <Tooltip.Trigger render={button} />
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup data-testid={item.mark ? `nav-mark-${item.id}-tip` : undefined}>
                  {tipLines.map((line, index) => (
                    <p key={index} className="m-0">
                      {line}
                    </p>
                  ))}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </nav>
  );

  if (!compact && !items.some((item) => item.mark)) return nav;
  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      {nav}
    </Tooltip.Provider>
  );
}
