'use client';

import { useMemo } from 'react';
import { InfoTip, Panel, Switch, Tooltip, cn, formatNumber, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';
import type { AbilityEffectReadout } from '@bombfarm/domain/ability-effect-readout';
import { abilityEffectText, abilityName } from '@bombfarm/domain/game-labels';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { TeamAuraId, TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { AbilityIcon } from '@bombfarm/game-art';
import { heroCopyFor, sub, type HeroCopy, type Lang } from '../copy';
import {
  ownAbilityRowsFor,
  teamAuraRowsFor,
  type OwnAbilityStatus,
} from '../model/abilities-auras-panel';

type ReadoutKind = Exclude<AbilityEffectReadout, { kind: 'none' }>['kind'];

const UNIT_KEY: Record<ReadoutKind, keyof HeroCopy> = {
  attackPct: 'heroDetailAuraUnitAttack',
  speedPct: 'heroDetailAuraUnitSpeed',
  critPoints: 'heroDetailAuraUnitCrit',
  drainPct: 'heroDetailAuraUnitDrain',
  penetrationPoints: 'heroDetailAuraUnitPenetration',
  critDmgPct: 'heroDetailAuraUnitCritDmg',
  rangeCells: 'heroDetailAuraUnitRange',
  dmgMult: 'heroDetailAuraUnitDmgMult',
  gateAttackPct: 'heroDetailAuraUnitGateAttack',
  packDmgPctPerAlly: 'heroDetailAuraUnitPackPerAlly',
  teamPulseDmgPct: 'heroDetailAuraUnitPulse',
};

/** Marcha's per-level step is 0.185%, a multiplier lands on 1.09, a radius on 1.0; the rest move
 *  in whole units. */
const UNIT_DECIMALS: Record<ReadoutKind, number> = {
  attackPct: 0,
  speedPct: 2,
  critPoints: 0,
  drainPct: 0,
  penetrationPoints: 0,
  critDmgPct: 0,
  rangeCells: 1,
  dmgMult: 2,
  gateAttackPct: 0,
  packDmgPctPerAlly: 1,
  teamPulseDmgPct: 0,
};

const STATUS_KEY: Record<OwnAbilityStatus, keyof HeroCopy> = {
  own: 'heroDetailAuraOwnTag',
  notHere: 'heroDetailAuraNotHereTag',
  notModelled: 'heroDetailAuraNotModelledTag',
};

const numericClass = 'font-mono text-xs tabular-nums';
const tagClass = 'text-[10px] font-bold tracking-[0.06em] uppercase text-muted';
const columnHeadClass = 'text-[9px] font-bold tracking-[0.08em] uppercase text-muted';
const groupHeadClass = 'mt-3 mb-1.5 text-[10px] font-bold tracking-[0.08em] uppercase text-accent';
const rowClass =
  'grid grid-cols-[2.75rem_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-line py-1.5 sm:grid-cols-[2.75rem_auto_minmax(0,1fr)_7rem_7rem_8rem]';
const figuresClass = 'col-start-3 flex flex-wrap gap-x-3 sm:contents';

function readoutText(readout: AbilityEffectReadout, t: HeroCopy, lang: Lang): string {
  if (readout.kind === 'none') return '—';
  return sub(t[UNIT_KEY[readout.kind]], {
    value: formatNumber(readout.value, lang, UNIT_DECIMALS[readout.kind]),
  });
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
    <Panel data-testid="abilities-auras">
      <Tooltip.Provider delay={200} closeDelay={100}>
        <div className={panelHClass}>
          <span className="flex items-center gap-1.5">
            <h2 className={panelTitleClass}>{t.heroDetailAurasTitle}</h2>
            <InfoTip label={t.heroDetailAurasTitle} tip={t.heroDetailAurasTip} />
          </span>
        </div>
      </Tooltip.Provider>

      <h3 className={groupHeadClass}>{t.heroDetailAurasTeamGroup}</h3>
      <div className={cn(rowClass, 'hidden border-t-0 py-0 sm:grid')} aria-hidden>
        <span />
        <span />
        <span className={columnHeadClass}>{t.heroDetailAurasColumnAura}</span>
        <span className={columnHeadClass}>{t.heroDetailAurasColumnPricedAt}</span>
        <span className={columnHeadClass}>{t.heroDetailAurasColumnCap}</span>
        <span className={columnHeadClass}>{t.heroDetailAurasColumnDelta}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {auraRows.map((row) => {
          const name = abilityName(row.buffId, lang);
          const deltaText = sub(row.on ? t.heroDetailAuraDeltaIfOff : t.heroDetailAuraDeltaIfOn, {
            value: formatNumber(Math.abs(row.deltaPct), lang, 1),
          });
          return (
            <li key={row.buffId} data-testid={`team-aura-${row.buffId}`} className={rowClass}>
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
              <AbilityIcon code={row.buffId} size="sm" className={cn('shrink-0', !row.on && 'opacity-40')} />
              <div className={cn('flex min-w-0 flex-col', !row.on && 'text-muted')}>
                <span className="text-[12px] font-semibold">{name}</span>
                <span className="text-[11px] leading-1.3 text-muted">
                  {abilityEffectText(row.buffId, lang)}
                </span>
              </div>
              <div className={figuresClass}>
                <span className={cn(numericClass, !row.on && 'text-muted')} data-testid="team-aura-priced-at">
                  {row.pricedAt ? readoutText(row.pricedAt, t, lang) : '—'}
                </span>
                <span className={cn(numericClass, 'text-muted')}>{readoutText(row.cap, t, lang)}</span>
                <span className={cn(numericClass, deltaClass(row.deltaPct))} data-testid="team-aura-delta">
                  {deltaText}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className={groupHeadClass}>{t.heroDetailAurasOwnGroup}</h3>
      {ownRows.length === 0 ? (
        <p className={cn(tipClass, 'm-0')}>{t.heroDetailAurasNoOwnAbilities}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {ownRows.map((row) => (
            <li key={row.abilityId} data-testid={`own-ability-${row.abilityId}`} className={rowClass}>
              <span />
              <AbilityIcon
                code={row.abilityId}
                size="sm"
                className={cn('shrink-0', row.status !== 'own' && 'opacity-40')}
              />
              <div className={cn('flex min-w-0 flex-col', row.status !== 'own' && 'text-muted')}>
                <span className="text-[12px] font-semibold">{abilityName(row.abilityId, lang)}</span>
                <span className="text-[11px] leading-1.3 text-muted">
                  {sub(t.heroDetailAuraRank, { rank: formatNumber(row.rank, lang, 0) })} ·{' '}
                  {abilityEffectText(row.abilityId, lang)}
                </span>
              </div>
              <div className={figuresClass}>
                <span className={cn(numericClass, row.status !== 'own' && 'text-muted')}>
                  {readoutText(row.effect, t, lang)}
                </span>
                <span className="hidden sm:block" />
                <span className={tagClass} data-testid="own-ability-status">
                  {t[STATUS_KEY[row.status]]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
