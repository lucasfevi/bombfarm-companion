import { contextBridge, ipcRenderer } from 'electron';
import log from 'electron-log/renderer.js';
import {
  createPingResponse,
  isIpcEventChannel,
  type IpcEventChannel,
  type IpcEvents,
  type IpcInvokeChannel,
  type IpcInvokeResult,
} from '@bombfarm/contracts';

log.transports.console.level = 'debug';
log.info({ scope: 'preload', event: 'boot' });

async function invoke<C extends IpcInvokeChannel>(
  channel: C,
): Promise<IpcInvokeResult<C>> {
  return ipcRenderer.invoke('bfc:invoke', channel) as Promise<IpcInvokeResult<C>>;
}

function on<C extends IpcEventChannel>(
  channel: C,
  handler: (payload: IpcEvents[C]) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: IpcEvents[C]) => {
    handler(payload);
  };
  ipcRenderer.on(`bfc:event:${channel}`, listener);
  return () => {
    ipcRenderer.removeListener(`bfc:event:${channel}`, listener);
  };
}

contextBridge.exposeInMainWorld('bfc', {
  invoke,
  on,
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
      on: typeof on;
      ping: () => ReturnType<typeof createPingResponse>;
      logBoot: () => ReturnType<typeof createPingResponse>;
    };
  }
}

export { isIpcEventChannel };
