'use client';

import type { ReactNode } from 'react';
import { isTeamAuraId, ownAbilityReadout } from '@bombfarm/domain/ability-effect-readout';
import { ABILITY_LEVEL_MAX, SHEET_ABILITIES } from '@bombfarm/domain/model';
import { abilityEffectText, abilityName, abilityReadoutText, peekLabel } from '@bombfarm/domain/game-labels';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { formatNumber } from '@bombfarm/ui';
import { AbilityIcon } from '../ability-icon';
import { PeekFrame } from './peek-frame';
import {
  peekEffectClass,
  peekFootClass,
  peekHeadClass,
  peekNameClass,
  peekNameTextClass,
  peekRowClass,
  peekRowsClass,
  peekRuleClass,
  peekSubClass,
  peekTagClass,
  peekTagTeamClass,
} from './peek.recipe';

export type AbilityPeekProps = {
  id: string;
  level: number;
  /** The rank cap; every catalog ability's unless the caller knows otherwise. */
  max?: number | undefined;
  lang: Lang;
  children: ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
  stopRowActivation?: boolean | undefined;
};

const SHEET_ABILITY_IDS = new Set(SHEET_ABILITIES.map((ability) => ability.id));

function rankLine(level: number, max: number, lang: Lang): string {
  return peekLabel('rankOf', lang)
    .replace('{rank}', formatNumber(level, lang, 0))
    .replace('{max}', formatNumber(max, lang, 0));
}

/** The card an ability opens: its rank, what a rank does, and what this rank and the cap add up to. */
export function AbilityPeekCard({ id, level, max = ABILITY_LEVEL_MAX, lang }: Pick<AbilityPeekProps, 'id' | 'level' | 'max' | 'lang'>) {
  const name = abilityName(id, lang);
  const format = (value: number, decimals: number) => formatNumber(value, lang, decimals);
  const now = ownAbilityReadout(id, level);
  const cap = ownAbilityReadout(id, max);
  const team = isTeamAuraId(id);
  const onSheet = SHEET_ABILITY_IDS.has(id);

  return (
    <div data-slot="ability-peek">
      <div className={peekHeadClass}>
        <AbilityIcon code={id} size="lg" level={level} max={max} className="shrink-0" />
        <div className="min-w-0">
          <div className={peekNameClass}>
            <span className={peekNameTextClass}>{name}</span>
          </div>
          <div className={peekSubClass}>
            <span className="text-muted">{rankLine(level, max, lang)}</span>
          </div>
        </div>
      </div>
      <div className={peekRuleClass} />
      <p className={peekEffectClass}>{abilityEffectText(id, lang)}</p>
      {now.kind !== 'none' ? (
        <div className={`${peekRowsClass} mt-1.5`}>
          <div className={peekRowClass}>
            <span>{peekLabel('atRank', lang).replace('{rank}', formatNumber(level, lang, 0))}</span>
            <b className="text-up!">{abilityReadoutText(now, lang, format)}</b>
          </div>
          {level < max ? (
            <div className={peekRowClass}>
              <span>{peekLabel('atCap', lang)}</span>
              <b className="text-muted!">{abilityReadoutText(cap, lang, format)}</b>
            </div>
          ) : null}
        </div>
      ) : null}
      {team || onSheet ? (
        <div className={peekFootClass}>
          <span className={team ? peekTagTeamClass : peekTagClass}>
            {peekLabel(team ? 'teamAura' : 'ownSheet', lang)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Wraps an ability's icon (or name) so hovering it opens {@link AbilityPeekCard}. */
export function AbilityPeek({ id, level, max, lang, children, className, disabled, stopRowActivation }: AbilityPeekProps) {
  const cap = max ?? ABILITY_LEVEL_MAX;
  return (
    <PeekFrame
      kind="ability"
      label={`${abilityName(id, lang)}, ${level}/${cap}`}
      className={className}
      disabled={disabled}
      stopRowActivation={stopRowActivation}
      card={<AbilityPeekCard id={id} level={level} max={cap} lang={lang} />}
    >
      {children}
    </PeekFrame>
  );
}
