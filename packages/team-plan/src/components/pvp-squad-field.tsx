'use client';

import { formatNumber } from '@bombfarm/ui';
import { formatPhaseLabel } from '@bombfarm/farm';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';
import { PVP_WINDOW_SECS } from '../core/combat-window';
import { SetupField } from './setup-field';

/**
 * The duel facts, in the phase control's place: how many heroes the scope board fields against
 * the squad's slots, the phase the room is hardened to, and the minute. The squad is picked on
 * the scope board below, so this only reads it back — and says so when it is over the slots.
 */
export function PvpSquadField({
  t,
  lang,
  roomPhase,
  fielded,
  slots,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  /** The phase the room is hardened to, or `null` when the plan falls back to the account's. */
  roomPhase: number | null;
  /** Heroes the scope board keeps on the field — Optimize and Leave alone. */
  fielded: number;
  /** The duel squad's slots — the account's own, or the top house's with none read. */
  slots: number;
}) {
  const excess = Math.max(0, fielded - slots);
  return (
    <SetupField
      label={t.teamPlanPvpSquadLabel}
      hint={t.teamPlanPvpSquadHint}
      className="min-w-64 max-w-sm flex-1"
      testId="team-plan-pvp-squad"
    >
      <p className="m-0 flex min-h-[34px] items-center text-[13px] whitespace-nowrap text-ink">
        {sub(t.teamPlanPvpSquadValue, {
          count: formatNumber(fielded, lang, 0),
          max: formatNumber(slots, lang, 0),
          phase: roomPhase === null ? t.teamPlanPvpRoomUnknown : formatPhaseLabel(roomPhase, lang),
          secs: formatNumber(PVP_WINDOW_SECS, lang, 0),
        })}
      </p>
      {excess > 0 ? (
        <p className="m-0 mt-1.5 text-[12px] leading-snug text-warn" role="status">
          {sub(t.teamPlanPvpSquadTooMany, { max: formatNumber(slots, lang, 0), excess: formatNumber(excess, lang, 0) })}
        </p>
      ) : null}
    </SetupField>
  );
}
