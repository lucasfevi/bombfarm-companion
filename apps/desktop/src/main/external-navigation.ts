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
}

const DENY_NEW_WINDOW = { action: 'deny' } as const;

export function applyExternalNavigationPolicy(
  contents: WebContents,
  deps: ExternalNavigationDeps,
): void {
  const { openExternal, log, entryUrl, internalUrls = [] } = deps;

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

  // Chromium commits a page's own navigation to `about:blank` without raising any `will-*` event,
  // and a window left there has no bridge and no script until the app restarts. `did-start-navigation`
  // is raised for the navigations the policy refuses too, so it only notes what a page started; the
  // window is sent back when that navigation actually commits somewhere off the app origin. A load
  // the main process started itself has no initiating frame and is never second-guessed.
  let startedByPage: string | null = null;
  contents.on('did-start-navigation', (details) => {
    startedByPage =
      details.isMainFrame && !details.isSameDocument && details.initiator ? details.url : null;
  });
  contents.on('did-navigate', (_event, url) => {
    const started = startedByPage;
    startedByPage = null;
    if (started === null || decideTopLevelNavigation(url, internalUrls) === 'allow') {
      return;
    }
    refuse(url, 'did-navigate');
    setImmediate(() => {
      if (contents.isDestroyed()) {
        return;
      }
      void contents.loadURL(entryUrl).catch((error: unknown) => {
        log.error({ scope: 'main', event: 'navigation.recover_failed', url: entryUrl, error: String(error) });
      });
    });
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
