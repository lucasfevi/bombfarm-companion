import { isApplyInjectRequest, type ApplyInjectRequest } from '@bombfarm/contracts';

/**
 * The smoke's seam. Unlike the forge's (a pure replay), this ARMS a scripted run that the next
 * `apply:start` consumes: the UI's smoke runs on the fixture account, where a real start answers
 * `offline`, and the confirm-modal flow only opens on a real start -> event -> done round trip.
 */
export interface ApplyInjector {
  arm(payload: unknown): { ok: boolean };
  take(): ApplyInjectRequest | null;
}

export function createApplyInjector(deps: { honoured: () => boolean }): ApplyInjector {
  let armed: ApplyInjectRequest | null = null;
  return {
    arm(payload) {
      if (!deps.honoured() || !isApplyInjectRequest(payload)) return { ok: false };
      armed = payload;
      return { ok: true };
    },
    take() {
      const script = armed;
      armed = null;
      return script;
    },
  };
}
