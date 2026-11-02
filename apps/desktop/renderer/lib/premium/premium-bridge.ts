import type { CapabilityReply, PremiumHostView, PremiumPauseReason } from '@bombfarm/contracts';

/** What the Premium screen is told when the host pauses or resumes its bundle. */
export interface PremiumPauseInfo {
  readonly reason: PremiumPauseReason | undefined;
}

/** The one prop the Premium screen receives. */
export interface PremiumProp {
  /** Resolves with the capability's value; rejects with `Error(code)` when the host refuses. */
  call(capability: string, args?: unknown): Promise<unknown>;
  /** Subscribes to the host pausing or resuming the bundle; returns what unsubscribes. */
  on(event: 'paused' | 'resumed', fn: (info: PremiumPauseInfo) => void): () => void;
}

export type PremiumUiInvoke = (capability: string, args: unknown) => Promise<CapabilityReply>;

/** The prop, plus the one way the mount point tells it what the host view now says. */
export interface PremiumBridge {
  readonly prop: PremiumProp;
  feed(host: PremiumHostView | null): void;
}

type Listener = (info: PremiumPauseInfo) => void;

/** The window's own bridge to main; absent where there is no preload (the static export build). */
export const invokeFromWindow: PremiumUiInvoke = (capability, args) => {
  const bfc = (
    window as unknown as {
      bfc?: { invoke: (channel: 'premium:uiCall', capability: string, args: unknown) => Promise<CapabilityReply> };
    }
  ).bfc;
  if (bfc === undefined) return Promise.reject(new Error('unavailable'));
  return bfc.invoke('premium:uiCall', capability, args);
};

export function createPremiumBridge(invoke: PremiumUiInvoke = invokeFromWindow): PremiumBridge {
  const listeners: Record<'paused' | 'resumed', Set<Listener>> = { paused: new Set(), resumed: new Set() };
  let paused = false;

  const prop: PremiumProp = {
    async call(capability, args) {
      let reply: CapabilityReply;
      try {
        reply = await invoke(capability, args);
      } catch {
        throw new Error('unavailable');
      }
      if (!reply.ok) throw new Error(reply.error);
      return reply.value;
    },
    on(event, fn) {
      listeners[event].add(fn);
      return () => {
        listeners[event].delete(fn);
      };
    },
  };

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
