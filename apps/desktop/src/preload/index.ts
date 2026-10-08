import { contextBridge, ipcRenderer } from 'electron';
import log from 'electron-log/renderer.js';
import {
  createPingResponse,
  ipcEventName,
  isIpcEventChannel,
  type IpcEventChannel,
  type IpcEvents,
  type IpcInvokeArgs,
  type IpcInvokeChannel,
  type IpcInvokeResult,
} from '@bombfarm/contracts';

interface RendererErrorRecord {
  event: string;
  screen: string;
  message: string;
  stack: string;
  componentStack: string;
}

log.transports.console.level = 'debug';
log.info({ scope: 'preload', event: 'boot' });

async function invoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeArgs<C>
): Promise<IpcInvokeResult<C>> {
  return ipcRenderer.invoke('bfc:invoke', channel, ...args) as Promise<IpcInvokeResult<C>>;
}

function on<C extends IpcEventChannel>(
  channel: C,
  handler: (payload: IpcEvents[C]) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: IpcEvents[C]) => {
    handler(payload);
  };
  const name = ipcEventName(channel);
  ipcRenderer.on(name, listener);
  return () => {
    ipcRenderer.removeListener(name, listener);
  };
}

contextBridge.exposeInMainWorld('bfc', {
  invoke,
  on,
  ping: () => createPingResponse('preload'),
  logRendererError: (record: RendererErrorRecord) => {
    log.error({ scope: 'renderer', ...record });
  },
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
      logRendererError: (record: RendererErrorRecord) => void;
    };
  }
}

export { isIpcEventChannel };
