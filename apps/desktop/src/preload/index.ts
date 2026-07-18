import { contextBridge, ipcRenderer } from 'electron';
import log from 'electron-log/renderer.js';
import { createPingResponse, type IpcInvokeChannel, type IpcInvokeResult } from '@bombfarm/contracts';

log.transports.console.level = 'debug';
log.info({ scope: 'preload', event: 'boot' });

async function invoke<C extends IpcInvokeChannel>(
  channel: C,
): Promise<IpcInvokeResult<C>> {
  return ipcRenderer.invoke('bfc:invoke', channel) as Promise<IpcInvokeResult<C>>;
}

contextBridge.exposeInMainWorld('bfc', {
  invoke,
  ping: () => createPingResponse('preload'),
  logBoot: () => {
    log.info({ scope: 'preload', event: 'boot.bridge' });
    return createPingResponse('preload');
  },
});

declare global {
  interface Window {
    bfc: {
      invoke: typeof invoke;
      ping: () => ReturnType<typeof createPingResponse>;
      logBoot: () => ReturnType<typeof createPingResponse>;
    };
  }
}

export {};
