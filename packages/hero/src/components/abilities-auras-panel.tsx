'use client';

import { useMemo } from 'react';
import { InfoTip, Panel, Switch, Tooltip, cn, formatNumber, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';
import type { AbilityEffectReadout } from '@bombfarm/domain/ability-effect-readout';
import { abilityName, abilityReadoutText } from '@bombfarm/domain/game-labels';
import { ABILITY_LEVEL_MAX } from '@bombfarm/domain/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { TeamAuraId, TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { AbilityIcon, AbilityPeek } from '@bombfarm/game-art';
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
/** The two groups side by side once the panel is wide enough for two columns of cards, each
 *  group two cards across; under that they stack, and under a phone's width the cards do too. */
const groupsClass = 'mt-3 grid grid-cols-1 gap-x-5 gap-y-3 @min-[52rem]:grid-cols-2';
const cardsClass = 'm-0 grid list-none grid-cols-1 gap-1.5 p-0 @min-[26rem]:grid-cols-2';
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
        <section>
          <h3 className={groupHeadClass}>{t.heroDetailAurasTeamGroup}</h3>
          <ul className={cardsClass}>
            {auraRows.map((row) => {
              const name = abilityName(row.buffId, lang);
              const rank = row.carried ? hero.abilities[row.buffId] : undefined;
              const deltaText = sub(row.on ? t.heroDetailAuraDeltaIfOff : t.heroDetailAuraDeltaIfOn, {
                value: formatNumber(Math.abs(row.deltaPct), lang, 1),
              });
              return (
                <li key={row.buffId} data-testid={`team-aura-${row.buffId}`} className={cn(cardClass, !row.on && 'text-muted')}>
                  <AbilityPeek id={row.buffId} level={rank} lang={lang}>
                    <AbilityIcon
                      code={row.buffId}
                      size="md"
                      {...(rank === undefined ? {} : { level: rank, max: ABILITY_LEVEL_MAX })}
                      className={cn(!row.on && 'opacity-40')}
                    />
                  </AbilityPeek>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[12px] leading-tight font-semibold">{name}</span>
                    <span className={cn(numericClass, 'flex min-w-0 flex-wrap items-baseline gap-x-2')}>
                      <span className={cn(!row.on && 'text-muted')} data-testid="team-aura-priced-at">
                        {row.pricedAt ? readoutText(row.pricedAt, lang) : '—'}
                      </span>
                      <span className={deltaClass(row.deltaPct)} data-testid="team-aura-delta">
                        {deltaText}
                      </span>
                    </span>
                    <span className={cn(numericClass, 'truncate text-muted')}>
                      {t.heroDetailAurasColumnCap} {readoutText(row.cap, lang)}
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

        <section>
          <h3 className={groupHeadClass}>{t.heroDetailAurasOwnGroup}</h3>
          {ownRows.length === 0 ? (
            <p className={cn(tipClass, 'm-0')}>{t.heroDetailAurasNoOwnAbilities}</p>
          ) : (
            <ul className={cardsClass}>
              {ownRows.map((row) => (
                <li
                  key={row.abilityId}
                  data-testid={`own-ability-${row.abilityId}`}
                  className={cn(cardClass, row.status !== 'own' && 'text-muted')}
                >
                  <AbilityPeek id={row.abilityId} level={row.rank} lang={lang}>
                    <AbilityIcon
                      code={row.abilityId}
                      size="md"
                      level={row.rank}
                      max={ABILITY_LEVEL_MAX}
                      className={cn(row.status !== 'own' && 'opacity-40')}
                    />
                  </AbilityPeek>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[12px] leading-tight font-semibold">{abilityName(row.abilityId, lang)}</span>
                    <span className={cn(numericClass, row.status === 'own' ? 'text-ink' : 'text-muted')}>
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
