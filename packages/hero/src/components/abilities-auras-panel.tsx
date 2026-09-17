'use client';

import { useMemo } from 'react';
import { InfoTip, Panel, Switch, Tooltip, cn, formatNumber, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';
import type { AbilityEffectReadout } from '@bombfarm/domain/ability-effect-readout';
import { abilityName, abilityReadoutText } from '@bombfarm/domain/game-labels';
import { ABILITY_LEVEL_MAX } from '@bombfarm/domain/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { TeamAuraId, TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { AbilityIcon } from '@bombfarm/game-art';
import { heroCopyFor, sub, type HeroCopy, type Lang } from '../copy';
import {
  ownAbilityRowsFor,
  teamAuraRowsFor,
  type OwnAbilityStatus,
} from '../model/abilities-auras-panel';

const STATUS_KEY: Record<OwnAbilityStatus, keyof HeroCopy> = {
  own: 'heroDetailAuraOwnTag',
  notHere: 'heroDetailAuraNotHereTag',
  notModelled: 'heroDetailAuraNotModelledTag',
};

const numericClass = 'font-mono text-[11px] leading-snug tabular-nums';
const tagClass = 'text-[10px] font-bold tracking-[0.06em] uppercase text-muted';
const groupHeadClass = 'mb-1.5 text-[10px] font-bold tracking-[0.08em] uppercase text-accent';
/** A card takes more columns only while each can still print its longest line whole, in
 *  Portuguese, beside the widest thing its right column holds — an aura card's "+3,70% de
 *  velocidade" beside "própria", an own ability's "+50% de chance de subir raridade" beside "não
 *  nesta fase" — so the groups sit side by side only once each half holds two aura cards, and
 *  each group measures its own width for how many cards go across. */
const groupsClass = 'mt-3 grid grid-cols-1 gap-x-5 gap-y-3 @min-[67.5rem]:grid-cols-2';
const groupClass = '@container min-w-0';
const auraCardsClass = 'm-0 grid list-none grid-cols-1 gap-1.5 p-0 @min-[33rem]:grid-cols-2 @min-[50rem]:grid-cols-3';
const ownCardsClass = 'm-0 grid list-none grid-cols-1 gap-1.5 p-0 @min-[48rem]:grid-cols-2';
const cardClass =
  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm border border-line bg-bg px-2 py-1.5';

function readoutText(readout: AbilityEffectReadout, lang: Lang): string {
  return abilityReadoutText(readout, lang, (value, decimals) => formatNumber(value, lang, decimals));
}

function deltaClass(deltaPct: number): string {
  if (Math.abs(deltaPct) < 0.05) return 'text-muted';
  return deltaPct > 0 ? 'text-up' : 'text-down';
}

/**
 * What one hero's figures are priced with: every team aura the game has, each behind a switch
 * unless it is the hero's own, and every ability of the hero's own that is in force.
 *
 * The switches are the one control here that changes what another stage prints — the strip,
 * Gear and Points all read the same pipeline — so each row says what flipping it would do to
 * sustained DPS before the reader does. The tip says where the uptime-weighted figures live
 * instead, because the same hero prints a different DPS there.
 *
 * A card is three lines whatever its switch says — name, the figure, the delta — and none of
 * them wraps, so flipping a switch recolours the card and moves nothing around it.
 */
export function AbilitiesAurasPanel({
  hero,
  phase,
  switches,
  deltas,
  onSwitch,
  lang,
}: {
  hero: Pick<HeroRecord, 'abilities'>;
  phase: number;
  switches: TeamAuraSwitches;
  deltas: Record<TeamAuraId, number>;
  onSwitch: (buffId: TeamAuraId, enabled: boolean) => void;
  lang: Lang;
}) {
  const t = heroCopyFor(lang);
  const auraRows = useMemo(() => teamAuraRowsFor(hero, switches, deltas), [hero, switches, deltas]);
  const ownRows = useMemo(() => ownAbilityRowsFor(hero, phase), [hero, phase]);

  return (
    <Panel data-testid="abilities-auras" className="@container min-w-0">
      <Tooltip.Provider delay={200} closeDelay={100}>
        <div className={panelHClass}>
          <span className="flex items-center gap-1.5">
            <h2 className={panelTitleClass}>{t.heroDetailAurasTitle}</h2>
            <InfoTip label={t.heroDetailAurasTitle} tip={t.heroDetailAurasTip} />
          </span>
        </div>
      </Tooltip.Provider>

      <div className={groupsClass}>
        <section className={groupClass}>
          <h3 className={groupHeadClass}>{t.heroDetailAurasTeamGroup}</h3>
          <ul className={auraCardsClass}>
            {auraRows.map((row) => {
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
                      onCheckedChange={(enabled) => onSwitch(row.buffId, enabled)}
                      aria-label={sub(t.heroDetailAuraSwitchAria, { name })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className={groupClass}>
          <h3 className={groupHeadClass}>{t.heroDetailAurasOwnGroup}</h3>
          {ownRows.length === 0 ? (
            <p className={cn(tipClass, 'm-0')}>{t.heroDetailAurasNoOwnAbilities}</p>
          ) : (
            <ul className={ownCardsClass}>
              {ownRows.map((row) => (
                <li
                  key={row.abilityId}
                  data-testid={`own-ability-${row.abilityId}`}
                  className={cn(cardClass, row.status !== 'own' && 'text-muted')}
                >
                  <AbilityIcon
                    code={row.abilityId}
                    size="md"
                    level={row.rank}
                    max={ABILITY_LEVEL_MAX}
                    className={cn(row.status !== 'own' && 'opacity-40')}
                    peek={{ lang, level: row.rank }}
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[12px] leading-tight font-semibold">{abilityName(row.abilityId, lang)}</span>
                    <span className={cn(numericClass, 'truncate', row.status === 'own' ? 'text-ink' : 'text-muted')}>
                      {readoutText(row.effect, lang)}
                    </span>
                  </div>
                  <span className={tagClass} data-testid="own-ability-status">
                    {t[STATUS_KEY[row.status]]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}
