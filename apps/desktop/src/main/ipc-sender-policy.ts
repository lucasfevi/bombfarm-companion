import type { IpcInvokeChannel } from '@bombfarm/contracts';
import { RENDERER_HOST, RENDERER_SCHEME } from './renderer-protocol.js';

export type SenderWindow = 'main' | 'mini-live';

export type IpcSenderRefusal =
  | 'no_frame'
  | 'detached_frame'
  | 'not_top_frame'
  | 'unknown_window'
  | 'untrusted_origin'
  | 'channel_not_allowed';

export type IpcSenderVerdict = { readonly allowed: true } | { readonly allowed: false; readonly reason: IpcSenderRefusal };

export interface SenderFrameFacts {
  readonly url: string;
  readonly isTopLevel: boolean;
  readonly detached: boolean;
}

export interface SenderFrameLike {
  readonly url: string;
  readonly parent: unknown;
  readonly detached: boolean;
  readonly processId: number;
  readonly routingId: number;
}

export interface IpcSenderPolicy {
  readonly trustedOrigins: ReadonlySet<string>;
  readonly miniLiveChannels: ReadonlySet<string>;
}

/** Everything the compact Live window's renderer asks of the main process. Fail-closed: a channel
 *  added to that window must be added here, and `mini-live-channel-allowlist.test.ts` fails until
 *  it is. */
export const MINI_LIVE_INVOKE_CHANNELS: ReadonlySet<IpcInvokeChannel> = new Set<IpcInvokeChannel>([
  'settings:get',
  'account:get',
  'live:get',
  'live:resetEarnings',
  'miniLive:getLayout',
  'miniLive:setLayout',
  'miniLive:fitGrowthAxis',
  'miniLive:close',
]);

const TRUSTED_PROTOCOLS: ReadonlySet<string> = new Set([`${RENDERER_SCHEME}:`, 'http:', 'https:']);

/** Protocol and host (port included), or null when the URL carries credentials, is not
 *  parseable, or is not a scheme a renderer is ever served from. `URL.origin` is the string
 *  "null" for the custom `app:` scheme under Node, so it cannot be compared. */
export function trustedOriginKeyOf(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!TRUSTED_PROTOCOLS.has(url.protocol) || url.username !== '' || url.password !== '') {
    return null;
  }
  return `${url.protocol}//${url.host}`;
}

export function createIpcSenderPolicy(input: { isDev: boolean; devRendererUrl: string }): IpcSenderPolicy {
  const trusted = new Set<string>([`${RENDERER_SCHEME}://${RENDERER_HOST}`]);
  if (input.isDev) {
    const devOrigin = trustedOriginKeyOf(input.devRendererUrl);
    if (devOrigin !== null && !devOrigin.startsWith(`${RENDERER_SCHEME}:`)) {
      trusted.add(devOrigin);
    }
  }
  return { trustedOrigins: trusted, miniLiveChannels: MINI_LIVE_INVOKE_CHANNELS };
}

export function readSenderFrame(
  frame: SenderFrameLike | null,
  mainFrame: Pick<SenderFrameLike, 'processId' | 'routingId'> | null,
): SenderFrameFacts | null {
  if (frame === null) {
    return null;
  }
  try {
    return {
      url: frame.url,
      detached: frame.detached,
      isTopLevel:
        frame.parent === null &&
        mainFrame !== null &&
        frame.processId === mainFrame.processId &&
        frame.routingId === mainFrame.routingId,
    };
  } catch {
    return null;
  }
}

export function decideIpcSender(
  input: { senderWindow: SenderWindow | null; frame: SenderFrameFacts | null; channel: unknown },
  policy: IpcSenderPolicy,
): IpcSenderVerdict {
  const { senderWindow, frame, channel } = input;
  if (frame === null) return refuse('no_frame');
  if (frame.detached) return refuse('detached_frame');
  if (!frame.isTopLevel) return refuse('not_top_frame');
  if (senderWindow === null) return refuse('unknown_window');

  const origin = trustedOriginKeyOf(frame.url);
  if (origin === null || !policy.trustedOrigins.has(origin)) return refuse('untrusted_origin');

  if (senderWindow === 'mini-live' && !(typeof channel === 'string' && policy.miniLiveChannels.has(channel))) {
    return refuse('channel_not_allowed');
  }
  return { allowed: true };
}

function refuse(reason: IpcSenderRefusal): IpcSenderVerdict {
  return { allowed: false, reason };
}

const MAX_LOGGED_CHANNEL_LENGTH = 64;

function loggableOrigin(frame: SenderFrameFacts | null): string {
  if (frame === null) return 'none';
  try {
    const url = new URL(frame.url);
    return url.host === '' ? url.protocol : `${url.protocol}//${url.host}`;
  } catch {
    return 'unparseable';
  }
}

export function ipcSenderRejectionRecord(
  input: { senderWindow: SenderWindow | null; frame: SenderFrameFacts | null; channel: unknown },
  reason: IpcSenderRefusal,
): Record<string, unknown> {
  return {
    scope: 'main',
    event: 'ipc.sender_rejected',
    reason,
    window: input.senderWindow ?? 'unknown',
    origin: loggableOrigin(input.frame),
    channel: typeof input.channel === 'string' ? input.channel.slice(0, MAX_LOGGED_CHANNEL_LENGTH) : typeof input.channel,
  };
}
