import type { ApplySkipReason, ApplyStopReason, ApplyCallKind } from '@bombfarm/contracts';
import type { RequestOutcome } from '@bombfarm/game-api';

/** The two extra codes observed before this feature (an out-of-band capture, not reproduced
 *  here): a lock or a new code stops the step instead. */
export const SKIP_CODES: Record<string, ApplySkipReason> = {
  HERO_LEVEL_TOO_LOW: 'heroLevel',
  NOT_ENOUGH_GOLD: 'notEnoughGold',
  NO_SUCH_HERO: 'heroMissing',
  NO_SUCH_ITEM: 'itemMissing',
  ALREADY_EQUIPPED: 'itemMoved',
};

export type ApplyCallVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'skip'; readonly reason: ApplySkipReason; readonly code?: string }
  | { readonly kind: 'cooldown' }
  | {
      readonly kind: 'stop';
      readonly stop: Exclude<ApplyStopReason, 'finished' | 'stopped' | 'game_not_running' | 'consent_revoked'>;
      readonly code: string | null;
    };

function http404Skip(call: ApplyCallKind): ApplyCallVerdict {
  return { kind: 'skip', reason: call === 'equip' || call === 'unequip' ? 'itemMissing' : 'heroMissing' };
}

export function classifyApplyOutcome(outcome: RequestOutcome, call: ApplyCallKind): ApplyCallVerdict {
  switch (outcome.kind) {
    case 'ok':
      return { kind: 'ok' };
    case 'cooldown':
      return { kind: 'cooldown' };
    case 'unauthorized':
      return { kind: 'stop', stop: 'unauthorized', code: null };
    case 'transport_error':
    case 'malformed_json':
    case 'too_large':
      return { kind: 'stop', stop: 'network', code: null };
    case 'http_error':
      if (outcome.status === 404) return http404Skip(call);
      if (outcome.status >= 500) return { kind: 'stop', stop: 'network', code: null };
      return { kind: 'stop', stop: 'refused', code: `HTTP_${String(outcome.status)}` };
    case 'api_error': {
      const reason = SKIP_CODES[outcome.code];
      return reason ? { kind: 'skip', reason, code: outcome.code } : { kind: 'stop', stop: 'refused', code: outcome.code };
    }
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
