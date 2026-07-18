export {};

declare global {
  interface Window {
    bfc?: {
      invoke: <C extends import('@bombfarm/contracts').IpcInvokeChannel>(
        channel: C,
      ) => Promise<import('@bombfarm/contracts').IpcInvokeResult<C>>;
      ping: () => { ok: true; from: 'preload' };
      logBoot: () => { ok: true; from: 'preload' };
    };
  }
}
