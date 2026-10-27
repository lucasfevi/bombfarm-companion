import { contextBridge, ipcRenderer } from 'electron';
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
});

declare global {
  interface Window {
    bfc: {
      invoke: typeof invoke;
      on: typeof on;
      ping: () => ReturnType<typeof createPingResponse>;
    };
  }
}

export { isIpcEventChannel };
