import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';
import { AppNav } from './app-nav';
import { cn } from './cn';
import {
  appShellActionsClass,
  appShellBrandClass,
  appShellBrandNameClass,
  appShellBrandRowClass,
  appShellBrandTagClass,
  appShellDragStripClass,
  appShellHeaderClass,
  appShellMainClass,
  appShellMainInnerClass,
  appShellRootClass,
  appShellStatusBarClass,
} from './AppShell.recipe';

export interface AppShellNavItem {
  id: string;
  label: string;
}

export interface AppShellProps extends PropsWithChildren {
  title?: string;
  /** Flavor badge — kept from M0; the desktop Playwright smoke test asserts `data-testid="flavor-badge"`. */
  badge?: string | null;
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
  /** Right padding (px) held clear for OS caption buttons, alongside `draggable`. */
  overlayInset?: number;
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
 * not. It also has to stop short of `overlayInset`, because the OS already claims that strip for
 * its caption buttons and two claims on the same pixels is what makes a drag stick and jump.
 */
const DRAG_STRIP_STYLE: AppRegionStyle = { WebkitAppRegion: 'drag' };

/**
 * Painting above the drag handle is not enough to stay out of it. The draggable region is built
 * from this property alone — paint order and stacking are not consulted — so anything that takes
 * a click has to say so, or the window manager claims the press before the button ever sees it.
 */
const NO_DRAG_STYLE: AppRegionStyle = { WebkitAppRegion: 'no-drag' };

/**
 * AppShell — sticky top bar (brand + nav pill + actions) over a single scrolling `<main>`, plus a
 * slim status strip. Same top-bar shape as the web's `SiteHeader`, built from the shared `AppNav`
 * pill rather than the desktop's former icon-rail sidebar. Nav is controlled (`activeId` +
 * `onNavigate`) and data-driven (`items`) rather than a hardcoded route list.
 */
export function AppShell({
  title = 'Bomb Farm Companion',
  badge,
  items = [],
  activeId,
  onNavigate,
  brand,
  actions,
  status,
  progress,
  version,
  draggable = false,
  overlayInset,
  children,
}: AppShellProps) {
  const navItems = items.map((item) => ({ id: item.id, label: item.label, active: item.id === activeId }));

  const headerStyle = overlayInset ? { paddingRight: overlayInset } : undefined;
  const dragStripStyle = overlayInset
    ? { ...DRAG_STRIP_STYLE, right: overlayInset }
    : DRAG_STRIP_STYLE;
  const interactiveStyle = draggable ? NO_DRAG_STYLE : undefined;

  return (
    <div className={appShellRootClass}>
      <header className={appShellHeaderClass} style={headerStyle}>
        {draggable ? <div aria-hidden className={appShellDragStripClass} style={dragStripStyle} /> : null}
        <div className="relative flex min-w-0 items-center gap-4">
          <div className={appShellBrandRowClass} style={interactiveStyle}>
            {brand}
            <div className={appShellBrandClass}>
              <div className={appShellBrandNameClass}>{title}</div>
              {badge ? (
                <span data-testid="flavor-badge" className={appShellBrandTagClass}>
                  {badge}
                </span>
              ) : null}
            </div>
          </div>
          {navItems.length > 0 ? (
            <div style={interactiveStyle}>
              <AppNav items={navItems} onSelect={onNavigate} />
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className={cn(appShellActionsClass, 'relative')} style={interactiveStyle}>
            {actions}
          </div>
        ) : null}
      </header>

      <main className={appShellMainClass}>
        <div className={appShellMainInnerClass}>{children}</div>
      </main>

      <footer className={appShellStatusBarClass}>
        {status ? <div className="flex items-center gap-2">{status}</div> : null}
        {progress ? <div className="flex items-center gap-2">{progress}</div> : null}
        {version ? <div className="ml-auto flex items-center gap-2">{version}</div> : null}
      </footer>
    </div>
  );
}
