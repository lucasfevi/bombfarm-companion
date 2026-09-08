import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';
import { AppNav } from './app-nav';
import type { IconName } from './icon';
import type { ShellDensity } from './shell-density';
import { WINDOW_CONTROLS_WIDTH } from './window-controls.recipe';
import {
  appShellActionsClass,
  appShellBarClass,
  appShellBrandClass,
  appShellBrandNameClass,
  appShellBrandRowClass,
  appShellBrandTagClass,
  appShellDragStripClass,
  appShellFlavorBadgeClass,
  appShellHeaderClass,
  appShellMainClass,
  appShellMainInnerClass,
  appShellRootClass,
  appShellStatusBarClass,
  appShellStatusInnerClass,
  appShellWindowControlsClass,
} from './AppShell.recipe';

export interface AppShellNavItem {
  id: string;
  label: string;
  /** Drawn in place of the label once the bar is too narrow to spell every tab; an item without
   *  one keeps its words. */
  icon?: IconName;
}

export interface AppShellProps extends PropsWithChildren {
  /** The product name, bold, on the lockup's first line. */
  title?: string | undefined;
  /** The small uppercase line beneath it — the web header's own second line. */
  suiteTag?: string | undefined;
  /** Flavor badge — kept from M0; the desktop Playwright smoke test asserts `data-testid="flavor-badge"`. */
  badge?: string | null;
  /**
   * How much of the bar fits. Passed in rather than measured here so this component stays a pure
   * function of its props — the window is the caller's to observe, with `useShellDensity`.
   */
  density?: ShellDensity;
  /** Omitted/empty renders no nav landmark. */
  items?: AppShellNavItem[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  /** Mark rendered left of the brand lockup — e.g. `BrandMark`. Renders nothing when omitted. */
  brand?: ReactNode;
  /** Right-hand header slot — e.g. the desktop's PT/EN `SegmentedToggle`. */
  actions?: ReactNode;
  /** Status-bar slots — absent ones render nothing (no empty boxes, no layout shift). */
  status?: ReactNode;
  /** Reserved for M4 pricing passes; renders nothing until a caller passes it. */
  progress?: ReactNode;
  version?: ReactNode;
  /**
   * The desktop's custom title bar. Applies `-webkit-app-region: drag` to the header and
   * `no-drag` to its interactive regions (brand, nav, actions) so the OS can still move the
   * window by its chrome.
   */
  draggable?: boolean;
  /**
   * The window's caption buttons, drawn at the end of the actions cluster — e.g. the desktop's
   * `WindowControls`. Renders nothing when omitted, which is what a surface whose window controls
   * belong to the OS wants.
   */
  windowControls?: ReactNode;
}

/** `-webkit-app-region` has no Tailwind utility and isn't a standard CSS property TypeScript knows. */
interface AppRegionStyle extends CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

/**
 * The drag handle is its own empty rectangle behind the header's content rather than the header
 * itself. Chromium builds the draggable region as a polygon over every `app-region` element, so
 * marking the header and then un-marking each interactive child makes that region a many-sided
 * shape recomputed against the whole subtree; one static rectangle with nothing inside it does
 * not. It spans the whole header: the caption buttons are the actions cluster's own children now,
 * and that cluster is already excused from the region below.
 */
const DRAG_STRIP_STYLE: AppRegionStyle = { WebkitAppRegion: 'drag' };

/**
 * Painting above the drag handle is not enough to stay out of it. The draggable region is built
 * from this property alone — paint order and stacking are not consulted — so anything that takes
 * a click has to say so, or the window manager claims the press before the button ever sees it.
 */
const NO_DRAG_STYLE: AppRegionStyle = { WebkitAppRegion: 'no-drag' };

/**
 * The right padding the bar's content needs to stay out of the caption buttons, given that the
 * content is already inset from the window edge by the measure's own right gutter. Above the
 * measure that gutter is wider than the buttons and this resolves to zero, which is the point: a
 * wide window lines the actions up with the panels below rather than holding a strip clear twice,
 * and the buttons keep the corner to themselves. `100%` resolves against the header's content
 * box, so the subtraction is the live gutter.
 */
function captionClearance(): string {
  return `max(0px, ${WINDOW_CONTROLS_WIDTH}px - (100% - min(var(--container-desktop), 100%)) / 2 - var(--shell-gutter) - var(--scrollbar))`;
}

/**
 * AppShell — sticky top bar (brand + nav pill + actions) over a single scrolling `<main>`, plus a
 * slim status strip. Same top-bar shape as the web's `SiteHeader`, built from the shared `AppNav`
 * pill rather than the desktop's former icon-rail sidebar. Nav is controlled (`activeId` +
 * `onNavigate`) and data-driven (`items`) rather than a hardcoded route list.
 */
export function AppShell({
  title = 'Bomb Farm',
  suiteTag = 'Companion',
  badge,
  density = 'full',
  items = [],
  activeId,
  onNavigate,
  brand,
  actions,
  status,
  progress,
  version,
  draggable = false,
  windowControls,
  children,
}: AppShellProps) {
  const navItems = items.map((item) => ({
    id: item.id,
    label: item.label,
    active: item.id === activeId,
    ...(item.icon === undefined ? {} : { icon: item.icon }),
  }));
  const iconTabs = density !== 'full';
  const brandMarkOnly = density === 'brand-mark' || density === 'actions-collapsed';

  const interactiveStyle = draggable ? NO_DRAG_STYLE : undefined;
  const barStyle = windowControls ? { paddingRight: captionClearance() } : undefined;

  return (
    <div className={appShellRootClass}>
      <header className={appShellHeaderClass}>
        {draggable ? <div aria-hidden className={appShellDragStripClass} style={DRAG_STRIP_STYLE} /> : null}
        <div className={appShellBarClass} style={barStyle}>
          <div className="flex min-w-0 items-center gap-4">
            <div className={appShellBrandRowClass} style={interactiveStyle}>
              {brand}
              {brandMarkOnly ? null : (
                <>
                  <div className={appShellBrandClass}>
                    <div className={appShellBrandNameClass}>{title}</div>
                    {suiteTag ? <div className={appShellBrandTagClass}>{suiteTag}</div> : null}
                  </div>
                  {badge ? (
                    <span data-testid="flavor-badge" className={appShellFlavorBadgeClass}>
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </div>
            {navItems.length > 0 ? (
              <div style={interactiveStyle}>
                <AppNav items={navItems} onSelect={onNavigate} compact={iconTabs} />
              </div>
            ) : null}
          </div>

          {actions ? (
            <div className={appShellActionsClass} style={interactiveStyle}>
              {actions}
            </div>
          ) : null}
        </div>
        {windowControls ? (
          <div className={appShellWindowControlsClass} style={interactiveStyle}>
            {windowControls}
          </div>
        ) : null}
      </header>

      <main className={appShellMainClass}>
        <div className={appShellMainInnerClass}>{children}</div>
      </main>

      <footer className={appShellStatusBarClass}>
        {status || progress || version ? (
          <div className={appShellStatusInnerClass}>
            {status ? <div className="flex items-center gap-2">{status}</div> : null}
            {progress ? <div className="flex items-center gap-2">{progress}</div> : null}
            {version ? <div className="ml-auto flex items-center gap-2">{version}</div> : null}
          </div>
        ) : null}
      </footer>
    </div>
  );
}
