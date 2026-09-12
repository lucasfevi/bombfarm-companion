'use client';

import { useMemo } from 'react';
import { Panel, Switch, cn, formatNumber, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';
import { abilityName } from '@bombfarm/domain/game-labels';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  TEAM_BUFF_ABILITY_IDS,
  teamAurasAroundHero,
  type TeamAuraSwitches,
  type TeamBuffId,
} from '@bombfarm/domain/team-buffs';
import { heroCopyFor, sub, type HeroCopy, type Lang } from '../copy';

const UNIT_KEY: Record<TeamBuffId, keyof HeroCopy> = {
  grito_guerra: 'heroDetailAuraUnitAttack',
  pressagio_mortal: 'heroDetailAuraUnitCrit',
  marcha_acelerada: 'heroDetailAuraUnitSpeed',
  folego_mineiro: 'heroDetailAuraUnitDrain',
};

/** Marcha's per-level step is 0.185%, so its totals need the second decimal; the other three
 *  move in whole units. */
const UNIT_DECIMALS: Record<TeamBuffId, number> = {
  grito_guerra: 0,
  pressagio_mortal: 0,
  marcha_acelerada: 2,
  folego_mineiro: 0,
};

/**
 * The four team auras from one hero's seat, and a switch per aura for the rest of the roster.
 *
 * A hero's detail screen prices the hero alone: its own aura always counts, and every other
 * fielded carrier is a what-if behind its switch — on, at full presence. The tip says so, and
 * says where the uptime-weighted figures live instead, because the same hero prints a different
 * DPS there and a reader comparing the two deserves the reason beside the control.
 */
export function TeamAuraSwitchesPanel({
  hero,
  roster,
  switches,
  onSwitch,
  lang,
}: {
  hero: Pick<HeroRecord, 'id' | 'abilities'>;
  roster: readonly Pick<HeroRecord, 'id' | 'abilities' | 'battleAllowed'>[];
  switches: TeamAuraSwitches;
  onSwitch: (buffId: TeamBuffId, enabled: boolean) => void;
  lang: Lang;
}) {
  const t = heroCopyFor(lang);
  const around = useMemo(() => teamAurasAroundHero(hero, roster), [hero, roster]);

  const unit = (buffId: TeamBuffId, value: number) =>
    sub(t[UNIT_KEY[buffId]], { value: formatNumber(value, lang, UNIT_DECIMALS[buffId]) });

  return (
    <Panel data-testid="team-aura-switches">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroDetailAurasTitle}</h2>
      </div>
      <p className={tipClass}>{t.heroDetailAurasTip}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {TEAM_BUFF_ABILITY_IDS.map((buffId) => {
          const name = abilityName(buffId, lang);
          const { own, others, carriers } = around[buffId];
          const othersText =
            carriers === 0
              ? t.heroDetailAuraNoCarriers
              : carriers === 1
                ? sub(t.heroDetailAuraOthersOne, { value: unit(buffId, others) })
                : sub(t.heroDetailAuraOthersMany, { value: unit(buffId, others), count: carriers });
          return (
            <li
              key={buffId}
              data-testid={`team-aura-${buffId}`}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-[12px] font-semibold">{name}</span>
                {own > 0 ? (
                  <span className={cn(tipClass, 'm-0')}>
                    {sub(t.heroDetailAuraOwn, { value: unit(buffId, own) })}
                  </span>
                ) : null}
                <span className={cn(tipClass, 'm-0')}>{othersText}</span>
              </div>
              {carriers > 0 ? (
                <Switch
                  checked={switches[buffId]}
                  onCheckedChange={(enabled) => onSwitch(buffId, enabled)}
                  aria-label={sub(t.heroDetailAuraSwitchAria, { name })}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
