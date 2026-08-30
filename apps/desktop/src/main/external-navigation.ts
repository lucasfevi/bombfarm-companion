import type { WebContents } from 'electron';
import type { LogPort } from './storage/index.js';

export type NavigationDecision = 'open-external' | 'allow-internal' | 'block';

const INTERNAL_SCHEMES: ReadonlySet<string> = new Set(['app:', 'devtools:']);

const OPAQUE_ORIGIN = 'null';

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function decideNavigation(
  rawUrl: string,
  internalUrls: readonly string[] = [],
): NavigationDecision {
  const target = parseUrl(rawUrl);
  if (!target) {
    return 'block';
  }

  if (INTERNAL_SCHEMES.has(target.protocol)) {
    return 'allow-internal';
  }

  if (
    target.origin !== OPAQUE_ORIGIN &&
    internalUrls.some((internalUrl) => parseUrl(internalUrl)?.origin === target.origin)
  ) {
    return 'allow-internal';
  }

  return target.protocol === 'https:' ? 'open-external' : 'block';
}

export interface ExternalNavigationDeps {
  openExternal: (url: string) => Promise<void>;
  log: LogPort;
  internalUrls?: readonly string[];
}

const DENY_NEW_WINDOW = { action: 'deny' } as const;

export function applyExternalNavigationPolicy(
  contents: WebContents,
  deps: ExternalNavigationDeps,
): void {
  const { openExternal, log, internalUrls = [] } = deps;

  const openInBrowser = (url: string, trigger: string): void => {
    log.info({ scope: 'main', event: 'navigation.opened_externally', trigger, url });
    void openExternal(url).catch((error: unknown) => {
      log.error({
        scope: 'main',
        event: 'navigation.open_external_failed',
        trigger,
        url,
        error: String(error),
      });
    });
  };

  const refuse = (url: string, trigger: string): void => {
    log.warn({ scope: 'main', event: 'navigation.blocked', trigger, url });
  };

  contents.setWindowOpenHandler(({ url }) => {
    if (decideNavigation(url, internalUrls) === 'open-external') {
      openInBrowser(url, 'window-open');
    } else {
      refuse(url, 'window-open');
    }
    return DENY_NEW_WINDOW;
  });

  contents.on('will-navigate', (details) => {
    const decision = decideNavigation(details.url, internalUrls);
    if (decision === 'allow-internal') {
      return;
    }
    details.preventDefault();
    if (decision === 'open-external') {
      openInBrowser(details.url, 'will-navigate');
    } else {
      refuse(details.url, 'will-navigate');
    }
  });
}
