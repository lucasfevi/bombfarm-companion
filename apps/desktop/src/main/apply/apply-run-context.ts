import type { ApplyCallKind, ApplySkipReason, ApplyStopReason } from '@bombfarm/contracts';
import type { HeroDetailReading, WriteCall } from '@bombfarm/game-api';
import type { ApplyCallVerdict } from './apply-outcome.js';

export type UnitResult =
  | { readonly kind: 'ok'; readonly goldSpent: number }
  | { readonly kind: 'skip'; readonly reason: ApplySkipReason; readonly code?: string }
  | {
      readonly kind: 'stop';
      readonly stop: Exclude<ApplyStopReason, 'finished'>;
      readonly code: string | null;
      readonly call: ApplyCallKind | null;
      readonly resetDone: boolean;
    };

/** What a step executor (`apply-equip-step.ts` / `apply-points-step.ts`) is given: one write
 *  call, with the pause/resend and Stop machinery already applied; one hero-detail read, the same
 *  way; and the running wallet figure. */
export interface ApplyRunContext {
  call(
    kind: ApplyCallKind,
    writeCall: WriteCall,
  ): Promise<ApplyCallVerdict | { readonly kind: 'stop'; readonly stop: Exclude<ApplyStopReason, 'finished'>; readonly code: null }>;
  readDetail(heroId: string): Promise<HeroDetailReading | 'paused-out'>;
  wallet(): number | null;
}
