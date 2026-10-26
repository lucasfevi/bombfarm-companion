import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import {
  applyExternalNavigationPolicy,
  decideFrameNavigation,
  decideNavigation,
  decideTopLevelNavigation,
} from './external-navigation.js';
import type { LogPort } from './storage/index.js';

const STEAM_LISTING =
  'https://steamcommunity.com/market/listings/3527290/Bomb%20Farm%20Crate';
const RENDERER_ENTRY = 'app://bundle/index.html';
const DEV_RENDERER = 'http://127.0.0.1:3000';

describe('decideNavigation', () => {
  it('opens an https Steam market listing in the default browser', () => {
    expect(decideNavigation(STEAM_LISTING)).toBe('open-external');
  });

  it('keeps the renderer bundle scheme inside the app', () => {
    expect(decideNavigation(RENDERER_ENTRY)).toBe('allow-internal');
  });

  it.each([
    'app://other-host/index.html',
    'app://bundle.evil/index.html',
    'app://bundle@evil/index.html',
    'app://bundle:8080/index.html',
    'app:///index.html',
  ])('does not treat the look-alike app url %s as internal', (url) => {
    expect(decideNavigation(url)).toBe('block');
  });

  it('keeps devtools inside the app', () => {
    expect(decideNavigation('devtools://devtools/bundled/devtools_app.html')).toBe('allow-internal');
  });

  it('keeps the dev renderer origin inside the app when it is declared internal', () => {
    expect(decideNavigation(`${DEV_RENDERER}/live`, [DEV_RENDERER])).toBe('allow-internal');
  });

  it('blocks an http origin that was not declared internal', () => {
    expect(decideNavigation('http://example.com/', [DEV_RENDERER])).toBe('block');
  });

  it('blocks javascript:', () => {
    expect(decideNavigation('javascript:alert(document.cookie)')).toBe('block');
  });

  it('blocks data:', () => {
    expect(decideNavigation('data:text/html,<script>fetch("http://evil")</script>')).toBe('block');
  });

  it('blocks file:', () => {
    expect(decideNavigation('file:///C:/Windows/System32/calc.exe')).toBe('block');
  });

  it('blocks an unknown scheme', () => {
    expect(decideNavigation('some-updater://install')).toBe('block');
  });

  it('does not match one opaque origin against another', () => {
    expect(decideNavigation('file:///C:/secrets.txt', ['data:text/plain,x'])).toBe('block');
  });

  it('blocks a malformed url instead of throwing', () => {
    expect(decideNavigation('not a url at all')).toBe('block');
    expect(decideNavigation('')).toBe('block');
    expect(decideNavigation('https://')).toBe('block');
  });
});

describe('decideTopLevelNavigation', () => {
  it.each([RENDERER_ENTRY, 'app://bundle/live', 'app://bundle/mini-live/index.html?x=1#y'])(
    'allows the app origin: %s',
    (url) => {
      expect(decideTopLevelNavigation(url)).toBe('allow');
    },
  );

  it.each([
    STEAM_LISTING,
    'http://example.com/',
    'app://bundle.evil/',
    'app://bundle@evil/',
    'app://bundle:8080/',
    'app:///index.html',
    'devtools://devtools/bundled/devtools_app.html',
    'about:blank',
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///C:/x',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(decideTopLevelNavigation(url, [DEV_RENDERER])).toBe('block');
  });

  it('allows the dev renderer origin only when it is declared', () => {
    expect(decideTopLevelNavigation(`${DEV_RENDERER}/live`)).toBe('block');
    expect(decideTopLevelNavigation(`${DEV_RENDERER}/live`, [DEV_RENDERER])).toBe('allow');
    expect(decideTopLevelNavigation('http://127.0.0.1:3001/', [DEV_RENDERER])).toBe('block');
    expect(decideTopLevelNavigation('https://127.0.0.1:3000/', [DEV_RENDERER])).toBe('block');
  });
});

describe('decideFrameNavigation', () => {
  it.each([RENDERER_ENTRY, 'about:blank', 'about:srcdoc', 'about:blank#x'])('allows %s', (url) => {
    expect(decideFrameNavigation(url)).toBe('allow');
  });

  it.each([
    STEAM_LISTING,
    'http://127.0.0.1:3000/',
    'data:text/html,x',
    'blob:app://bundle/1',
    'javascript:alert(1)',
    'about:other',
    'file:///C:/x',
    'app://bundle.evil/',
    '',
  ])('refuses %s', (url) => {
    expect(decideFrameNavigation(url)).toBe('block');
  });

  it('allows the dev renderer origin only when it is declared', () => {
    expect(decideFrameNavigation(`${DEV_RENDERER}/`, [DEV_RENDERER])).toBe('allow');
  });
});

interface NavigateDetails {
  url: string;
  isMainFrame: boolean;
  preventDefault(): void;
}

function createWebContentsSpy(): {
  contents: WebContents;
  openWindow(url: string): { action: string };
  navigate(url: string): { prevented: boolean };
  navigateFrame(url: string, options?: { isMainFrame?: boolean }): { prevented: boolean };
} {
  let openHandler: ((details: { url: string }) => { action: string }) | null = null;
  const listeners = new Map<string, (details: NavigateDetails) => void>();

  const contents = {
    setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) {
      openHandler = handler;
    },
    on(event: string, listener: (details: NavigateDetails) => void) {
      listeners.set(event, listener);
      return contents;
    },
  };

  const emit = (event: string, url: string, isMainFrame: boolean): { prevented: boolean } => {
    const listener = listeners.get(event);
    if (!listener) {
      throw new Error(`no ${event} listener registered`);
    }
    let prevented = false;
    listener({
      url,
      isMainFrame,
      preventDefault: () => {
        prevented = true;
      },
    });
    return { prevented };
  };

  return {
    contents: contents as unknown as WebContents,
    openWindow(url) {
      if (!openHandler) {
        throw new Error('no window-open handler registered');
      }
      return openHandler({ url });
    },
    navigate: (url) => emit('will-navigate', url, true),
    navigateFrame: (url, options) => emit('will-frame-navigate', url, options?.isMainFrame ?? false),
  };
}

function createLogSpy(): LogPort & { records: Record<string, unknown>[] } {
  const records: Record<string, unknown>[] = [];
  return {
    records,
    info: (record) => records.push(record),
    warn: (record) => records.push(record),
    error: (record) => records.push(record),
  };
}

describe('applyExternalNavigationPolicy', () => {
  it('hands a target=_blank https link to the browser and creates no in-app window', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.openWindow(STEAM_LISTING)).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith(STEAM_LISTING);
  });

  it('never hands a non-https window-open url to the browser', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log });

    expect(spy.openWindow('javascript:alert(1)')).toEqual({ action: 'deny' });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', url: 'javascript:alert(1)' }),
    );
  });

  it('refuses an https navigation away from the app and never hands it to the browser', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log });

    expect(spy.navigate(STEAM_LISTING)).toEqual({ prevented: true });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', trigger: 'will-navigate', url: STEAM_LISTING }),
    );
  });

  it.each(['http://example.com/', 'javascript:alert(1)', 'data:text/html,x', 'file:///C:/x', 'app://bundle.evil/'])(
    'refuses a navigation to %s without opening anything',
    (url) => {
      const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
      const spy = createWebContentsSpy();
      applyExternalNavigationPolicy(spy.contents, { openExternal, log: createLogSpy() });

      expect(spy.navigate(url)).toEqual({ prevented: true });
      expect(openExternal).not.toHaveBeenCalled();
    },
  );

  it('lets the renderer navigate within its own bundle', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.navigate('app://bundle/live')).toEqual({ prevented: false });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('lets a dev run navigate within the dev renderer origin only', () => {
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, {
      openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
      log: createLogSpy(),
      internalUrls: [DEV_RENDERER],
    });

    expect(spy.navigate(`${DEV_RENDERER}/live`)).toEqual({ prevented: false });
    expect(spy.navigate('http://127.0.0.1:3001/live')).toEqual({ prevented: true });
  });

  it('refuses a subframe navigation to a foreign origin', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log });

    expect(spy.navigateFrame(STEAM_LISTING)).toEqual({ prevented: true });
    expect(spy.navigateFrame('data:text/html,x')).toEqual({ prevented: true });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', trigger: 'will-frame-navigate', url: STEAM_LISTING }),
    );
  });

  it('lets a subframe stay on the app origin or an empty document', () => {
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, {
      openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
      log: createLogSpy(),
    });

    expect(spy.navigateFrame('app://bundle/index.html')).toEqual({ prevented: false });
    expect(spy.navigateFrame('about:blank')).toEqual({ prevented: false });
    expect(spy.navigateFrame('about:srcdoc')).toEqual({ prevented: false });
  });

  it('leaves the main frame to the top-level handler', () => {
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, {
      openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
      log: createLogSpy(),
    });

    expect(spy.navigateFrame(STEAM_LISTING, { isMainFrame: true })).toEqual({ prevented: false });
  });

  it('logs a failure to hand the url to the browser', async () => {
    const openExternal = vi
      .fn<(url: string) => Promise<void>>()
      .mockRejectedValue(new Error('no browser'));
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log });

    spy.openWindow(STEAM_LISTING);
    await vi.waitFor(() => {
      expect(log.records).toContainEqual(
        expect.objectContaining({ event: 'navigation.open_external_failed' }),
      );
    });
  });
});
