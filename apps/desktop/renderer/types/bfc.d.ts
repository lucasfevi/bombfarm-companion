export {};

declare global {
  interface Window {
    bfc?: {
      invoke: <C extends import('@bombfarm/contracts').IpcInvokeChannel>(
        channel: C,
        ...args: import('@bombfarm/contracts').IpcInvokeArgs<C>
      ) => Promise<import('@bombfarm/contracts').IpcInvokeResult<C>>;
      on: <C extends import('@bombfarm/contracts').IpcEventChannel>(
        channel: C,
        handler: (payload: import('@bombfarm/contracts').IpcEvents[C]) => void,
      ) => () => void;
      ping: () => { ok: true; from: 'preload' };
      logBoot: () => { ok: true; from: 'preload' };
    };
  }

  /** Chromium's Window Controls Overlay API — not yet in TypeScript's `lib.dom`. */
  interface WindowControlsOverlay extends EventTarget {
    readonly visible: boolean;
    getTitlebarAreaRect: () => DOMRect;
  }

  interface Navigator {
    readonly windowControlsOverlay?: WindowControlsOverlay;
  }
}
