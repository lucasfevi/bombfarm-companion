import type { CapabilityReply, PremiumHostView, PremiumPauseReason, PremiumSlot } from '@bombfarm/contracts';

/** What the Premium screen is told when the host pauses or resumes its bundle. */
export interface PremiumPauseInfo {
  readonly reason: PremiumPauseReason | undefined;
}

/** The one prop the Premium screen receives. */
export interface PremiumProp {
  /** The slot this root is mounted in. */
  readonly slot: PremiumSlot;
  /**
   * Resolves with the capability's value; rejects with `Error(code)` when the host refuses. The
   * error also carries `code` and, when the host names one, `reason`.
   */
  call(capability: string, args?: unknown): Promise<unknown>;
  /** Subscribes to the host pausing or resuming the bundle; returns what unsubscribes. */
  on(event: 'paused' | 'resumed', fn: (info: PremiumPauseInfo) => void): () => void;
}

/** `slot` is passed only for a slot other than the Premium tab. */
export type PremiumUiInvoke = (capability: string, args: unknown, slot?: PremiumSlot) => Promise<CapabilityReply>;

/** What a refused call rejects with: the message is the code, and the reason rides along when there is one. */
export type PremiumCallError = Error & { readonly code: string; readonly reason?: string };

/** The prop, plus the one way the mount point tells it what the host view now says. */
export interface PremiumBridge {
  readonly prop: PremiumProp;
  feed(host: PremiumHostView | null): void;
}

type Listener = (info: PremiumPauseInfo) => void;

/** The window's own bridge to main; absent where there is no preload (the static export build). */
export const invokeFromWindow: PremiumUiInvoke = (capability, args, slot) => {
  const bfc = (
    window as unknown as {
      bfc?: {
        invoke: (channel: 'premium:uiCall', capability: string, args: unknown, slot?: PremiumSlot) => Promise<CapabilityReply>;
      };
    }
  ).bfc;
  if (bfc === undefined) return Promise.reject(new Error('unavailable'));
  return slot === undefined
    ? bfc.invoke('premium:uiCall', capability, args)
    : bfc.invoke('premium:uiCall', capability, args, slot);
};

/** `code` and `reason` are readable but not enumerable, so the error still compares as `Error(code)`. */
function refusal(code: string, reason?: string): PremiumCallError {
  const error = new Error(code);
  Object.defineProperty(error, 'code', { value: code });
  if (reason !== undefined) Object.defineProperty(error, 'reason', { value: reason });
  return error as PremiumCallError;
}

export function createPremiumBridge(
  invoke: PremiumUiInvoke = invokeFromWindow,
  slot: PremiumSlot = 'premium.tab',
): PremiumBridge {
  const listeners: Record<'paused' | 'resumed', Set<Listener>> = { paused: new Set(), resumed: new Set() };
  let paused = false;

  const prop = {
    async call(capability, args) {
      let reply: CapabilityReply;
      try {
        reply = await (slot === 'premium.tab' ? invoke(capability, args) : invoke(capability, args, slot));
      } catch {
        throw refusal('unavailable');
      }
      if (!reply.ok) throw refusal(reply.error, reply.reason);
      return reply.value;
    },
    on(event, fn) {
      listeners[event].add(fn);
      return () => {
        listeners[event].delete(fn);
      };
    },
  } as PremiumProp;

  // Readable, but not enumerable: the prop's own keys stay `call` and `on`.
  Object.defineProperty(prop, 'slot', { value: slot });

  return {
    prop,
    feed(host) {
      const now = host?.phase === 'paused';
      if (now === paused) return;
      paused = now;
      const info: PremiumPauseInfo = { reason: host !== null && now ? host.paused?.reason : undefined };
      for (const fn of [...listeners[now ? 'paused' : 'resumed']]) fn(info);
    },
  };
}
