'use client';

import { useMemo } from 'react';
import { InfoTip, Switch, cn, formatNumber } from '@bombfarm/ui';
import type { AbilityEffectReadout } from '@bombfarm/domain/ability-effect-readout';
import { abilityName, abilityReadoutText } from '@bombfarm/domain/game-labels';
import { ABILITY_LEVEL_MAX } from '@bombfarm/domain/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { TeamAuraId, TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { AbilityIcon } from '@bombfarm/game-art';
import { sub, type HeroCopy, type Lang } from '../copy';
import { teamAuraRowsFor } from '../model/abilities-auras-panel';

const numericClass = 'font-mono text-[11px] leading-snug tabular-nums';
const tagClass = 'text-[10px] font-bold tracking-[0.06em] uppercase text-muted';
const headClass = 'm-0 text-[10px] font-bold tracking-[0.08em] text-accent uppercase';
/** A card takes more columns only while each can still print its longest line whole, in
 *  Portuguese, beside the widest thing its right column holds — "+3,70% de velocidade" beside
 *  "própria". */
const auraCardsClass = 'm-0 mt-1.5 grid list-none grid-cols-1 gap-1.5 p-0 @min-[33rem]:grid-cols-2 @min-[50rem]:grid-cols-3';
const cardClass =
  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm border border-line bg-bg px-2 py-1.5';

export type TeamAuraControls = {
  readonly deltas: Record<TeamAuraId, number>;
  readonly onSwitch: (buffId: TeamAuraId, enabled: boolean) => void;
};

function readoutText(readout: AbilityEffectReadout, lang: Lang): string {
  return abilityReadoutText(readout, lang, (value, decimals) => formatNumber(value, lang, decimals));
}

function deltaClass(deltaPct: number): string {
  if (Math.abs(deltaPct) < 0.05) return 'text-muted';
  return deltaPct > 0 ? 'text-up' : 'text-down';
}

/**
 * Every team aura the game has, each behind a switch unless it is the hero's own. A switch is the
 * one control on the Combat stage that changes what another stage prints — the strip, Gear and
 * Points read the same pipeline — so each card says what flipping it would do to sustained DPS
 * before the reader does. Needs a `Tooltip.Provider` above it.
 *
 * A card is three lines whatever its switch says — name, the figure, the delta — and none of them
 * wraps, so flipping a switch recolours the card and moves nothing around it.
 */
export function TeamAurasSection({
  hero,
  switches,
  controls,
  t,
  lang,
}: {
  hero: Pick<HeroRecord, 'abilities'>;
  switches: TeamAuraSwitches;
  controls: TeamAuraControls;
  t: HeroCopy;
  lang: Lang;
}) {
  const rows = useMemo(() => teamAuraRowsFor(hero, switches, controls.deltas), [hero, switches, controls.deltas]);

  return (
    <section className="@container mt-5 min-w-0" data-testid="team-auras">
      <span className="flex items-center gap-1.5">
        <h3 className={headClass}>{t.heroDetailAurasTeamGroup}</h3>
        <InfoTip label={t.heroDetailAurasTeamGroup} tip={t.heroDetailAurasTip} />
      </span>
      <ul className={auraCardsClass}>
        {rows.map((row) => {
          const name = abilityName(row.buffId, lang);
          const rank = row.carried ? hero.abilities[row.buffId] : undefined;
          const deltaText = sub(row.on ? t.heroDetailAuraDeltaIfOff : t.heroDetailAuraDeltaIfOn, {
            value: formatNumber(Math.abs(row.deltaPct), lang, 1),
          });
          return (
            <li key={row.buffId} data-testid={`team-aura-${row.buffId}`} className={cn(cardClass, !row.on && 'text-muted')}>
              <AbilityIcon
                code={row.buffId}
                size="md"
                {...(rank === undefined ? {} : { level: rank, max: ABILITY_LEVEL_MAX })}
                className={cn(!row.on && 'opacity-40')}
                peek={{ lang, level: rank }}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[12px] leading-tight font-semibold">{name}</span>
                <span className={cn(numericClass, 'truncate', !row.on && 'text-muted')} data-testid="team-aura-readout">
                  {readoutText(row.readout, lang)}
                </span>
                <span className={cn(numericClass, 'truncate', deltaClass(row.deltaPct))} data-testid="team-aura-delta">
                  {deltaText}
                </span>
              </div>
              {row.carried ? (
                <span className={tagClass} data-testid="team-aura-own">
                  {t.heroDetailAuraOwnTag}
                </span>
              ) : (
                <Switch
                  checked={row.on}
                  onCheckedChange={(enabled) => controls.onSwitch(row.buffId, enabled)}
                  aria-label={sub(t.heroDetailAuraSwitchAria, { name })}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
