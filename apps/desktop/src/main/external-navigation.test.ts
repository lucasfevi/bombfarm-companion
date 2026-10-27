import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import {
  RECOVERY_LIMIT,
  RECOVERY_WINDOW_MS,
  applyExternalNavigationPolicy,
  createNavigationPolicyApplier,
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

  it('does not match one opaque origin against another', () => {
    expect(decideTopLevelNavigation('file:///C:/secrets.txt', ['data:text/plain,x'])).toBe('block');
    expect(decideFrameNavigation('file:///C:/secrets.txt', ['data:text/plain,x'])).toBe('block');
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

type RecoveryEvent = 'did-navigate' | 'did-stop-loading' | 'did-finish-load' | 'did-fail-load';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function createWebContentsSpy(): {
  contents: WebContents;
  openWindow(url: string): { action: string };
  navigate(url: string): { prevented: boolean };
  navigateFrame(url: string, options?: { isMainFrame?: boolean }): { prevented: boolean };
  redirect(url: string, options: { isMainFrame: boolean }): { prevented: boolean };
  /** The window lands on `url` by its own doing, then `events` are raised and the chain settles. */
  landOn(url: string, events?: readonly RecoveryEvent[]): Promise<void>;
  settle(): Promise<void>;
  destroy(): void;
  showing(url: string): void;
  /** What `isLoading()` answers: true while a navigation is pending or a document is loading. */
  loading(value: boolean): void;
  loadURL: ReturnType<typeof vi.fn<(url: string) => Promise<void>>>;
} {
  let currentUrl = '';
  let destroyed = false;
  let isLoading = false;
  const loadURL = vi.fn<(url: string) => Promise<void>>().mockImplementation((url) => {
    currentUrl = url;
    return Promise.resolve();
  });
  let openHandler: ((details: { url: string }) => { action: string }) | null = null;
  const listeners = new Map<string, (...args: unknown[]) => void>();

  const contents = {
    loadURL,
    getURL: () => {
      if (destroyed) {
        throw new Error('Object has been destroyed');
      }
      return currentUrl;
    },
    isDestroyed: () => destroyed,
    isLoading: () => isLoading,
    setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) {
      openHandler = handler;
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      listeners.set(event, listener);
      return contents;
    },
  };

  const emit = (event: string, url: string, isMainFrame: boolean): { prevented: boolean } => {
    const listener = listeners.get(event) as unknown as ((details: NavigateDetails) => void) | undefined;
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

  const settle = async (): Promise<void> => {
    for (let round = 0; round < 8; round += 1) {
      await tick();
    }
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
    redirect: (url, options) => emit('will-redirect', url, options.isMainFrame),
    loadURL,
    async landOn(url, events = ['did-navigate']) {
      currentUrl = url;
      for (const event of events) {
        const listener = listeners.get(event);
        if (!listener) {
          throw new Error(`no ${event} listener registered`);
        }
        listener({}, url);
      }
      await settle();
    },
    settle,
    loading(value) {
      isLoading = value;
    },
    showing(url) {
      currentUrl = url;
    },
    destroy() {
      destroyed = true;
    },
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

function applyPolicy(
  contents: WebContents,
  deps: Omit<Parameters<typeof applyExternalNavigationPolicy>[1], 'entryUrl'> & { entryUrl?: string },
): void {
  applyExternalNavigationPolicy(contents, { entryUrl: RENDERER_ENTRY, ...deps });
}

describe('applyExternalNavigationPolicy', () => {
  it('hands a target=_blank https link to the browser and creates no in-app window', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.openWindow(STEAM_LISTING)).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith(STEAM_LISTING);
  });

  it('never hands a non-https window-open url to the browser', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log });

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
    applyPolicy(spy.contents, { openExternal, log });

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
      applyPolicy(spy.contents, { openExternal, log: createLogSpy() });

      expect(spy.navigate(url)).toEqual({ prevented: true });
      expect(openExternal).not.toHaveBeenCalled();
    },
  );

  it('lets the renderer navigate within its own bundle', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.navigate('app://bundle/live')).toEqual({ prevented: false });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('lets a dev run navigate within the dev renderer origin only', () => {
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, {
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
    applyPolicy(spy.contents, { openExternal, log });

    expect(spy.navigateFrame(STEAM_LISTING)).toEqual({ prevented: true });
    expect(spy.navigateFrame('data:text/html,x')).toEqual({ prevented: true });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', trigger: 'will-frame-navigate', url: STEAM_LISTING }),
    );
  });

  it('lets a subframe stay on the app origin or an empty document', () => {
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, {
      openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
      log: createLogSpy(),
    });

    expect(spy.navigateFrame('app://bundle/index.html')).toEqual({ prevented: false });
    expect(spy.navigateFrame('about:blank')).toEqual({ prevented: false });
    expect(spy.navigateFrame('about:srcdoc')).toEqual({ prevented: false });
  });

  it('refuses a redirect off the app origin, in the main frame and in a subframe', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log, internalUrls: [DEV_RENDERER] });

    expect(spy.redirect(STEAM_LISTING, { isMainFrame: true })).toEqual({ prevented: true });
    expect(spy.redirect(STEAM_LISTING, { isMainFrame: false })).toEqual({ prevented: true });
    expect(spy.redirect(`${DEV_RENDERER}/live`, { isMainFrame: true })).toEqual({ prevented: false });
    expect(spy.redirect('about:blank', { isMainFrame: true })).toEqual({ prevented: true });
    expect(spy.redirect('about:blank', { isMainFrame: false })).toEqual({ prevented: false });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', trigger: 'will-redirect', url: STEAM_LISTING }),
    );
  });

  it('leaves the main frame to the top-level handler', () => {
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, {
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
    applyPolicy(spy.contents, { openExternal, log });

    spy.openWindow(STEAM_LISTING);
    await vi.waitFor(() => {
      expect(log.records).toContainEqual(
        expect.objectContaining({ event: 'navigation.open_external_failed' }),
      );
    });
  });

  describe('a window left off the app origin by its own page', () => {
    function setup(overrides: Partial<Parameters<typeof applyPolicy>[1]> = {}) {
      const spy = createWebContentsSpy();
      const log = createLogSpy();
      applyPolicy(spy.contents, {
        openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
        log,
        ...overrides,
      });
      return { spy, log };
    }

    it('loads the entry page again when the page lands on about:blank', async () => {
      const { spy, log } = setup({ entryUrl: 'app://bundle/mini-live/index.html' });

      await spy.landOn('about:blank');

      expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith('app://bundle/mini-live/index.html');
      expect(spy.contents.getURL()).toBe('app://bundle/mini-live/index.html');
      expect(log.records).toContainEqual(
        expect.objectContaining({ event: 'navigation.blocked', trigger: 'did-navigate', url: 'about:blank' }),
      );
    });

    it.each(['about:blank', 'about:blank?', 'about:srcdoc', 'data:text/html,x', 'https://example.com/', 'blob:app://bundle/1'])(
      'recovers from %s, whoever started the navigation and whichever event noticed it',
      async (url) => {
        for (const event of ['did-navigate', 'did-stop-loading', 'did-finish-load', 'did-fail-load'] as const) {
          const { spy } = setup();
          await spy.landOn(url, [event]);
          expect(spy.loadURL, event).toHaveBeenCalledExactlyOnceWith(RENDERER_ENTRY);
        }
      },
    );

    it('notices a window that never raised did-navigate, such as about:srcdoc at the top level', async () => {
      const { spy } = setup();
      await spy.landOn('about:srcdoc', ['did-stop-loading']);
      expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith(RENDERER_ENTRY);
    });

    it.each(['app://bundle/live', 'app://bundle/index.html?x=1#y'])('leaves a window on %s alone', async (url) => {
      const { spy } = setup();
      await spy.landOn(url, ['did-navigate', 'did-stop-loading', 'did-finish-load', 'did-fail-load']);
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('leaves a window with no page yet alone', async () => {
      const { spy } = setup();
      await spy.landOn('', ['did-stop-loading']);
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('allows the dev origin and sends a foreign one back to the entry page in a dev run', async () => {
      const { spy } = setup({ internalUrls: [DEV_RENDERER], entryUrl: `${DEV_RENDERER}/` });
      await spy.landOn(`${DEV_RENDERER}/live`);
      expect(spy.loadURL).not.toHaveBeenCalled();
      await spy.landOn('http://127.0.0.1:3001/');
      expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith(`${DEV_RENDERER}/`);
    });

    it('does not load again for each of several events that notice the same stranded window', async () => {
      const { spy } = setup();
      await spy.landOn('about:blank', ['did-navigate', 'did-stop-loading', 'did-finish-load', 'did-fail-load']);
      expect(spy.loadURL).toHaveBeenCalledOnce();
    });

    it('defers the load, so it never runs inside the event that noticed the window', async () => {
      const { spy } = setup();
      const pending = spy.landOn('about:blank');
      expect(spy.loadURL).not.toHaveBeenCalled();
      await pending;
      expect(spy.loadURL).toHaveBeenCalledOnce();
    });

    it('does not touch a window that is gone by the time the deferred load would run', async () => {
      const { spy } = setup();
      const pending = spy.landOn('about:blank');
      spy.destroy();
      await pending;
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('does nothing for a window that is already destroyed when an event arrives', async () => {
      const { spy } = setup();
      spy.destroy();
      await spy.landOn('about:blank');
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('checks again once its own load has settled, so a blank that arrived meanwhile is not missed', async () => {
      const { spy } = setup();
      spy.loadURL.mockImplementationOnce(() => {
        spy.showing('about:blank');
        return Promise.resolve();
      });
      await spy.landOn('about:blank');
      expect(spy.loadURL).toHaveBeenCalledTimes(2);
      expect(spy.contents.getURL()).toBe(RENDERER_ENTRY);
    });

    it('waits for the stranded document to stop loading, so the entry load is not cut short and charged twice', async () => {
      const { spy } = setup();
      spy.loading(true);
      await spy.landOn('about:blank', ['did-navigate']);
      expect(spy.loadURL).not.toHaveBeenCalled();

      spy.loading(false);
      await spy.landOn('about:blank', ['did-stop-loading']);

      expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith(RENDERER_ENTRY);
    });

    it('charges one recovery for one off-origin commit, even when its load settles before the entry page commits', async () => {
      const { spy } = setup();
      spy.loadURL.mockImplementationOnce(() => {
        spy.loading(true);
        return Promise.resolve();
      });

      await spy.landOn('about:blank');
      expect(spy.loadURL).toHaveBeenCalledOnce();

      spy.showing(RENDERER_ENTRY);
      spy.loading(false);
      await spy.landOn(RENDERER_ENTRY, ['did-navigate', 'did-stop-loading', 'did-finish-load']);
      expect(spy.loadURL).toHaveBeenCalledOnce();
    });

    it('keeps the budget whole: three separate attacks inside the window are three recoveries, and the fourth is refused', async () => {
      const { spy } = setup({ now: () => 0 });
      for (let attack = 1; attack <= RECOVERY_LIMIT; attack += 1) {
        spy.loadURL.mockImplementationOnce(() => {
          spy.loading(true);
          return Promise.resolve();
        });
        await spy.landOn('about:blank');
        expect(spy.loadURL, `attack ${String(attack)}`).toHaveBeenCalledTimes(attack);
        spy.showing(RENDERER_ENTRY);
        spy.loading(false);
        await spy.landOn(RENDERER_ENTRY, ['did-navigate', 'did-stop-loading', 'did-finish-load']);
      }

      await spy.landOn('about:blank');

      expect(spy.loadURL).toHaveBeenCalledTimes(RECOVERY_LIMIT);
    });

    it('still recovers a blank that lands after a recovery load settled mid-navigation', async () => {
      const { spy } = setup();
      spy.loadURL.mockImplementationOnce(() => {
        spy.loading(true);
        return Promise.resolve();
      });
      await spy.landOn('about:blank');
      expect(spy.loadURL).toHaveBeenCalledOnce();

      spy.loading(false);
      await spy.landOn('about:blank', ['did-navigate', 'did-stop-loading']);

      expect(spy.loadURL).toHaveBeenCalledTimes(2);
      expect(spy.contents.getURL()).toBe(RENDERER_ENTRY);
    });

    it('keeps recovering after a loadURL call that throws', async () => {
      const { spy } = setup();
      spy.loadURL.mockImplementationOnce(() => {
        throw new Error('invalid url');
      });
      expect(() => spy.contents.loadURL('not a url')).toThrow('invalid url');

      await spy.landOn('about:blank');

      expect(spy.loadURL).toHaveBeenLastCalledWith(RENDERER_ENTRY);
      expect(spy.loadURL).toHaveBeenCalledTimes(2);
    });

    it('hands the caller the load\'s own promise, rejection included', async () => {
      const { spy } = setup();
      const failure = new Error('ERR_FAILED');
      const load = Promise.reject(failure);
      spy.loadURL.mockReturnValueOnce(load);
      const returned = spy.contents.loadURL('data:text/html,x');
      expect(returned).toBe(load);
      await expect(returned).rejects.toBe(failure);
    });

    it('logs a recovery that fails instead of throwing', async () => {
      const { spy, log } = setup();
      spy.loadURL.mockRejectedValueOnce(new Error('aborted'));
      await spy.landOn('about:blank');
      expect(log.records).toContainEqual(expect.objectContaining({ event: 'navigation.recover_failed' }));
    });

    describe('a page the main process loaded on purpose', () => {
      it('is left alone, and so is the window while that load is still going', async () => {
        const { spy } = setup();
        const data = 'data:text/html,<title>navigated away</title>';
        let finish: () => void = () => undefined;
        spy.loadURL.mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finish = () => {
                spy.showing(data);
                resolve();
              };
            }),
        );

        const loading = spy.contents.loadURL(data);
        await spy.landOn('about:blank', ['did-navigate', 'did-stop-loading']);
        expect(spy.loadURL).toHaveBeenCalledOnce();

        finish();
        await loading;
        await spy.landOn(data, ['did-navigate', 'did-stop-loading', 'did-finish-load']);
        expect(spy.loadURL).toHaveBeenCalledOnce();
        expect(spy.contents.getURL()).toBe(data);
      });

      it('stops being trusted once the page itself moves on', async () => {
        const { spy } = setup();
        await spy.contents.loadURL('data:text/html,x');
        await spy.landOn('data:text/html,x');
        expect(spy.loadURL).toHaveBeenCalledOnce();

        await spy.landOn('about:blank');

        expect(spy.loadURL).toHaveBeenCalledTimes(2);
        expect(spy.loadURL).toHaveBeenLastCalledWith(RENDERER_ENTRY);
      });

      it('passes the url and options through and returns the load', async () => {
        const { spy } = setup();
        const options = { userAgent: 'x' };
        const loading = spy.contents.loadURL('app://bundle/live', options);
        expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith('app://bundle/live', options);
        await expect(loading).resolves.toBeUndefined();
      });

      it('does not trust a load that failed', async () => {
        const { spy } = setup();
        spy.loadURL.mockImplementationOnce((url) => {
          spy.showing(url);
          return Promise.reject(new Error('ERR_FAILED'));
        });
        await spy.contents.loadURL('data:text/html,x').catch(() => undefined);
        await spy.landOn('data:text/html,x', ['did-fail-load']);
        expect(spy.loadURL).toHaveBeenLastCalledWith(RENDERER_ENTRY);
      });

      it('does not trust the same page again after the window was sent back from it', async () => {
        const { spy } = setup();
        await spy.contents.loadURL('data:text/html,x');
        await spy.landOn('about:blank');
        expect(spy.loadURL).toHaveBeenCalledTimes(2);

        await spy.landOn('data:text/html,x');

        expect(spy.loadURL).toHaveBeenCalledTimes(3);
        expect(spy.loadURL).toHaveBeenLastCalledWith(RENDERER_ENTRY);
      });
    });

    describe('under a persistent injection', () => {
      function alwaysBlank(spy: ReturnType<typeof createWebContentsSpy>): void {
        spy.loadURL.mockImplementation(() => {
          spy.showing('about:blank');
          return Promise.resolve();
        });
      }

      it('stops after the limit within the window and says so once', async () => {
        const clock = 0;
        const { spy, log } = setup({ now: () => clock });
        alwaysBlank(spy);

        await spy.landOn('about:blank', ['did-navigate', 'did-stop-loading']);
        await spy.landOn('about:blank', ['did-navigate']);
        await spy.landOn('about:blank', ['did-fail-load']);

        expect(spy.loadURL).toHaveBeenCalledTimes(RECOVERY_LIMIT);
        expect(log.records.filter((record) => record.event === 'navigation.recovery_stopped')).toEqual([
          expect.objectContaining({ limit: RECOVERY_LIMIT, windowMs: RECOVERY_WINDOW_MS, url: 'about:blank' }),
        ]);
      });

      it('recovers again once the window has passed', async () => {
        let clock = 0;
        const { spy } = setup({ now: () => clock });
        alwaysBlank(spy);
        await spy.landOn('about:blank');
        expect(spy.loadURL).toHaveBeenCalledTimes(RECOVERY_LIMIT);

        clock += RECOVERY_WINDOW_MS;
        await spy.landOn('about:blank');

        expect(spy.loadURL.mock.calls.length).toBeGreaterThan(RECOVERY_LIMIT);
      });

      it('announces a new stop after the window got back on the app in between', async () => {
        let clock = 0;
        const { spy, log } = setup({ now: () => clock });
        alwaysBlank(spy);
        await spy.landOn('about:blank');
        spy.loadURL.mockImplementation((url) => {
          spy.showing(url);
          return Promise.resolve();
        });
        await spy.landOn(RENDERER_ENTRY);
        clock += RECOVERY_WINDOW_MS / 2;
        alwaysBlank(spy);
        await spy.landOn('about:blank');

        expect(log.records.filter((record) => record.event === 'navigation.recovery_stopped')).toHaveLength(2);
      });
    });
  });

  describe('createNavigationPolicyApplier', () => {
    const DEV_ENV = { isDev: true, devRendererUrl: DEV_RENDERER };
    const PACKAGED_ENV = { isDev: false, devRendererUrl: DEV_RENDERER };

    function applied(env: { isDev: boolean; devRendererUrl: string }, entryUrl = RENDERER_ENTRY) {
      const spy = createWebContentsSpy();
      const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
      const log = createLogSpy();
      createNavigationPolicyApplier(env, { openExternal, log })(spy.contents, entryUrl);
      return { spy, openExternal, log };
    }

    it.each([
      { env: DEV_ENV, url: `${DEV_RENDERER}/live`, prevented: false },
      { env: DEV_ENV, url: 'http://127.0.0.1:3001/live', prevented: true },
      { env: DEV_ENV, url: 'app://bundle/live', prevented: false },
      { env: DEV_ENV, url: STEAM_LISTING, prevented: true },
      { env: PACKAGED_ENV, url: `${DEV_RENDERER}/live`, prevented: true },
      { env: PACKAGED_ENV, url: 'app://bundle/live', prevented: false },
      { env: PACKAGED_ENV, url: STEAM_LISTING, prevented: true },
    ])('isDev $env.isDev: a top-level navigation to $url is prevented: $prevented', ({ env, url, prevented }) => {
      const { spy } = applied(env);
      expect(spy.navigate(url)).toEqual({ prevented });
    });

    it.each([
      { env: DEV_ENV, url: `${DEV_RENDERER}/`, prevented: false },
      { env: PACKAGED_ENV, url: `${DEV_RENDERER}/`, prevented: true },
    ])('isDev $env.isDev: a subframe navigation to $url is prevented: $prevented', ({ env, url, prevented }) => {
      const { spy } = applied(env);
      expect(spy.navigateFrame(url)).toEqual({ prevented });
    });

    it.each([
      { env: DEV_ENV, stays: true },
      { env: PACKAGED_ENV, stays: false },
    ])('isDev $env.isDev: a window on the dev origin stays there: $stays', async ({ env, stays }) => {
      const { spy } = applied(env, 'app://bundle/index.html');
      await spy.landOn(`${DEV_RENDERER}/live`);
      expect(spy.loadURL.mock.calls.length > 0).toBe(!stays);
    });

    it('sends a stranded window back to the entry page it was given', async () => {
      const { spy } = applied(PACKAGED_ENV, 'app://bundle/mini-live/index.html');
      await spy.landOn('about:blank');
      expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith('app://bundle/mini-live/index.html');
    });

    it('hands https window-open urls to the openExternal it was given', () => {
      const { spy, openExternal } = applied(PACKAGED_ENV);
      spy.openWindow(STEAM_LISTING);
      expect(openExternal).toHaveBeenCalledWith(STEAM_LISTING);
    });
  });
});
