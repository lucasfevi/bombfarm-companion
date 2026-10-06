import { isDeconstructInjectRequest, type DeconstructEvent } from '@bombfarm/contracts';

/**
 * The smoke hook: a scripted result pushed through the same `deconstruct:event` seam the real
 * service emits on, with no transport, no gate and no change to the account the renderer holds.
 * Whether it is honoured is the forge injector's own condition, decided by the caller — the
 * fixture account reader, unpackaged — so a shipped build cannot be made to draw a burn that
 * never happened.
 */
export interface DeconstructInjector {
  inject(payload: unknown): { ok: boolean };
}

export function createDeconstructInjector(deps: {
  honoured: () => boolean;
  emit: (event: DeconstructEvent) => void;
}): DeconstructInjector {
  return {
    inject(payload) {
      if (!deps.honoured() || !isDeconstructInjectRequest(payload)) return { ok: false };
      for (const event of payload.events) deps.emit(event);
      return { ok: true };
    },
  };
}
