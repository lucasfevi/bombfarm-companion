import type { IpcInvokeChannel } from '@bombfarm/contracts';
import type { AppEnv } from './env.js';
import type { RendererErrorGate } from './renderer-error-log.js';
import {
  createIpcSenderPolicy,
  decideIpcSender,
  ipcSenderRejectionRecord,
  readSenderFrame,
  type SenderFrameLike,
  type SenderWindow,
} from './ipc-sender-policy.js';

const RENDERER_ERROR_CHANNEL: IpcInvokeChannel = 'log:rendererError';

type FrameIds = Pick<SenderFrameLike, 'processId' | 'routingId'>;

export interface BridgeSender {
  readonly id: number;
  readonly mainFrame: FrameIds;
}

export interface BridgeInvokeEvent<Sender extends BridgeSender> {
  readonly sender: Sender;
  readonly senderFrame: SenderFrameLike | null;
}

export interface BridgeWindows {
  main: () => { readonly id: number } | null;
  mini: () => { readonly id: number } | null;
}

export function createSenderWindowResolver(windows: BridgeWindows): (sender: { readonly id: number }) => SenderWindow | null {
  return (sender) => {
    const main = windows.main();
    if (main !== null && sender.id === main.id) return 'main';
    const mini = windows.mini();
    if (mini !== null && sender.id === mini.id) return 'mini-live';
    return null;
  };
}

export function createBridgeInvokeHandler<Sender extends BridgeSender>(deps: {
  env: Pick<AppEnv, 'isDev'>;
  devRendererUrl: string;
  senderWindowOf: (sender: Sender) => SenderWindow | null;
  dispatch: (channel: string, ...args: unknown[]) => unknown;
  log: { warn: (record: Record<string, unknown>) => void };
  rendererErrorGate: RendererErrorGate;
}): (event: BridgeInvokeEvent<Sender>, channel: string, ...args: unknown[]) => unknown {
  const policy = createIpcSenderPolicy({ isDev: deps.env.isDev, devRendererUrl: deps.devRendererUrl });

  return (event, channel, ...args) => {
    const request = {
      senderWindow: deps.senderWindowOf(event.sender),
      frame: readSenderFrame(event.senderFrame, mainFrameOf(event.sender)),
      channel,
    };
    const verdict = decideIpcSender(request, policy);
    if (!verdict.allowed) {
      deps.log.warn(ipcSenderRejectionRecord(request, verdict.reason));
      throw new Error('IPC sender not permitted');
    }
    const { senderWindow } = request;
    if (channel === RENDERER_ERROR_CHANNEL && senderWindow !== null && !deps.rendererErrorGate.admit(senderWindow)) {
      return null;
    }
    return deps.dispatch(channel, ...args);
  };
}

function mainFrameOf(sender: BridgeSender): FrameIds | null {
  try {
    return sender.mainFrame;
  } catch {
    return null;
  }
}
