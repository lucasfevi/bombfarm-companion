import type { WebContents } from 'electron';
import { isRendererUrl } from './renderer-protocol.js';
import type { LogPort } from './storage/index.js';

export type NavigationDecision = 'open-external' | 'allow-internal' | 'block';

const OPAQUE_ORIGIN = 'null';

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isDeclaredInternalOrigin(target: URL, internalUrls: readonly string[]): boolean {
  return (
    target.origin !== OPAQUE_ORIGIN &&
    internalUrls.some((internalUrl) => parseUrl(internalUrl)?.origin === target.origin)
  );
}

export function decideNavigation(
  rawUrl: string,
  internalUrls: readonly string[] = [],
): NavigationDecision {
  const target = parseUrl(rawUrl);
  if (!target) {
    return 'block';
  }

  if (target.protocol === 'devtools:' || isRendererUrl(rawUrl)) {
    return 'allow-internal';
  }

  if (isDeclaredInternalOrigin(target, internalUrls)) {
    return 'allow-internal';
  }

  return target.protocol === 'https:' ? 'open-external' : 'block';
}

export type InAppNavigationDecision = 'allow' | 'block';

function isAppOrigin(rawUrl: string, internalUrls: readonly string[]): boolean {
  if (isRendererUrl(rawUrl)) {
    return true;
  }
  const target = parseUrl(rawUrl);
  return target !== null && isDeclaredInternalOrigin(target, internalUrls);
}

/** A page that leaves the app's own origin on its own (a meta refresh, `location`, a form) is
 *  never followed and never handed to the browser: markup alone can start one. */
export function decideTopLevelNavigation(
  rawUrl: string,
  internalUrls: readonly string[] = [],
): InAppNavigationDecision {
  return isAppOrigin(rawUrl, internalUrls) ? 'allow' : 'block';
}

const EMPTY_DOCUMENT_PATHS: ReadonlySet<string> = new Set(['blank', 'srcdoc']);

/** `about:blank` and `about:srcdoc` have no content of their own and inherit the embedder's
 *  origin, so they stand or fall with it. */
export function decideFrameNavigation(
  rawUrl: string,
  internalUrls: readonly string[] = [],
): InAppNavigationDecision {
  const target = parseUrl(rawUrl);
  if (target?.protocol === 'about:' && EMPTY_DOCUMENT_PATHS.has(target.pathname)) {
    return 'allow';
  }
  return isAppOrigin(rawUrl, internalUrls) ? 'allow' : 'block';
}

export interface ExternalNavigationDeps {
  openExternal: (url: string) => Promise<void>;
  log: LogPort;
  /** The page the window was created with; a window that lands anywhere else by its own doing is
   *  sent back to it. */
  entryUrl: string;
  internalUrls?: readonly string[];
  now?: () => number;
}

export const RECOVERY_LIMIT = 3;
export const RECOVERY_WINDOW_MS = 10_000;

const DENY_NEW_WINDOW = { action: 'deny' } as const;

export function applyExternalNavigationPolicy(
  contents: WebContents,
  deps: ExternalNavigationDeps,
): void {
  const { openExternal, log, entryUrl, internalUrls = [], now = Date.now } = deps;

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
    if (decideTopLevelNavigation(details.url, internalUrls) === 'allow') {
      return;
    }
    details.preventDefault();
    refuse(details.url, 'will-navigate');
  });

  contents.on('will-redirect', (details) => {
    const decide = details.isMainFrame ? decideTopLevelNavigation : decideFrameNavigation;
    if (decide(details.url, internalUrls) === 'allow') {
      return;
    }
    details.preventDefault();
    refuse(details.url, 'will-redirect');
  });

  // Chromium commits a page's own navigation to `about:blank` or `about:srcdoc` without raising any
  // `will-*` event, whoever started it, and a window left there has no bridge and no script until the
  // app restarts. So the window's state is checked instead of the navigation's cause: whenever the
  // main frame is off the app origin it is sent back to the entry page, unless the main process
  // deliberately loaded that page through `loadURL`, which this policy wraps to know.
  const loadEntry = contents.loadURL.bind(contents);
  let mainProcessLoads = 0;
  let trustedHref: string | null = null;
  contents.loadURL = (url, options) => {
    mainProcessLoads += 1;
    const loading = loadEntry(url, options);
    const settled = (): void => {
      mainProcessLoads -= 1;
    };
    loading.then(() => {
      settled();
      if (!contents.isDestroyed()) {
        trustedHref = contents.getURL();
      }
    }, settled);
    return loading;
  };

  let recovering = false;
  let gaveUp = false;
  let recoveryStarts: number[] = [];

  const recoverIfOffOrigin = (trigger: string): void => {
    if (mainProcessLoads > 0 || recovering || contents.isDestroyed()) {
      return;
    }
    const url = contents.getURL();
    if (url === '' || url === trustedHref) {
      return;
    }
    if (decideTopLevelNavigation(url, internalUrls) === 'allow') {
      gaveUp = false;
      return;
    }
    const at = now();
    recoveryStarts = recoveryStarts.filter((started) => at - started < RECOVERY_WINDOW_MS);
    if (recoveryStarts.length >= RECOVERY_LIMIT) {
      if (!gaveUp) {
        gaveUp = true;
        log.error({
          scope: 'main',
          event: 'navigation.recovery_stopped',
          trigger,
          url,
          limit: RECOVERY_LIMIT,
          windowMs: RECOVERY_WINDOW_MS,
        });
      }
      return;
    }
    recoveryStarts.push(at);
    recovering = true;
    trustedHref = null;
    refuse(url, trigger);
    setImmediate(() => {
      if (contents.isDestroyed()) {
        return;
      }
      loadEntry(entryUrl)
        .catch((error: unknown) => {
          log.error({ scope: 'main', event: 'navigation.recover_failed', url: entryUrl, error: String(error) });
        })
        .finally(() => {
          recovering = false;
          recoverIfOffOrigin('recovery-settled');
        });
    });
  };

  contents.on('did-navigate', () => {
    recoverIfOffOrigin('did-navigate');
  });
  contents.on('did-stop-loading', () => {
    recoverIfOffOrigin('did-stop-loading');
  });
  contents.on('did-finish-load', () => {
    recoverIfOffOrigin('did-finish-load');
  });
  contents.on('did-fail-load', () => {
    recoverIfOffOrigin('did-fail-load');
  });

  contents.on('will-frame-navigate', (details) => {
    if (details.isMainFrame || decideFrameNavigation(details.url, internalUrls) === 'allow') {
      return;
    }
    details.preventDefault();
    refuse(details.url, 'will-frame-navigate');
  });
}

export interface NavigationPolicyEnv {
  isDev: boolean;
  devRendererUrl: string;
}

/** The one navigation policy both windows are built with. */
export function createNavigationPolicyApplier(
  env: NavigationPolicyEnv,
  deps: Pick<ExternalNavigationDeps, 'openExternal' | 'log'>,
): (contents: WebContents, entryUrl: string) => void {
  const internalUrls = env.isDev ? [env.devRendererUrl] : [];
  return (contents, entryUrl) => {
    applyExternalNavigationPolicy(contents, { ...deps, entryUrl, internalUrls });
  };
}
