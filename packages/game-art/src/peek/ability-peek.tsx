'use client';

import type { ReactNode } from 'react';
import { isTeamAbilityId, ownAbilityReadout } from '@bombfarm/domain/ability-effect-readout';
import { ABILITY_LEVEL_MAX, SHEET_ABILITIES } from '@bombfarm/domain/model';
import { abilityEffectText, abilityName, abilityReadoutText, peekLabel } from '@bombfarm/domain/game-labels';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { formatNumber } from '@bombfarm/ui';
import { AbilityIcon } from '../ability-icon';
import { PeekFrame } from './peek-frame';
import {
  peekEffectClass,
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
  /** The carrier's rank. Leave it off for an ability with no carrier — a filter option, say. */
  level?: number | undefined;
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

function scopeTag(id: string, lang: Lang): ReactNode {
  const team = isTeamAbilityId(id);
  if (!team && !SHEET_ABILITY_IDS.has(id)) return null;
  return <span className={team ? peekTagTeamClass : peekTagClass}>{peekLabel(team ? 'teamAura' : 'ownSheet', lang)}</span>;
}

/**
 * The card an ability opens: its rank and scope, what a rank does, and what this rank and the cap
 * add up to. Without a rank it reads the ability alone — the name, the scope, and the cap.
 */
export function AbilityPeekCard({ id, level, max = ABILITY_LEVEL_MAX, lang }: Pick<AbilityPeekProps, 'id' | 'level' | 'max' | 'lang'>) {
  const name = abilityName(id, lang);
  const format = (value: number, decimals: number) => formatNumber(value, lang, decimals);
  const cap = ownAbilityReadout(id, max);
  const tag = scopeTag(id, lang);

  return (
    <div data-slot="ability-peek">
      <div className={peekHeadClass}>
        <AbilityIcon code={id} size="lg" {...(level === undefined ? {} : { level, max })} className="shrink-0" />
        <div className="min-w-0">
          <div className={peekNameClass}>
            <span className={peekNameTextClass}>{name}</span>
          </div>
          {level !== undefined || tag ? (
            <div className={peekSubClass}>
              {level !== undefined ? <span className="text-muted">{rankLine(level, max, lang)}</span> : null}
              {level !== undefined && tag ? <span className="text-muted">·</span> : null}
              {tag}
            </div>
          ) : null}
        </div>
      </div>
      <div className={peekRuleClass} />
      <p className={peekEffectClass}>{abilityEffectText(id, lang)}</p>
      {cap.kind !== 'none' ? (
        <div className={`${peekRowsClass} mt-1.5`}>
          {level !== undefined ? (
            <div className={peekRowClass}>
              <span>{peekLabel('atRank', lang).replace('{rank}', formatNumber(level, lang, 0))}</span>
              <b className="text-up!">{abilityReadoutText(ownAbilityReadout(id, level), lang, format)}</b>
            </div>
          ) : null}
          <div className={peekRowClass}>
            <span>{peekLabel('atCap', lang)}</span>
            <b className="text-muted!">{abilityReadoutText(cap, lang, format)}</b>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Wraps an ability's icon (or name) so hovering it opens {@link AbilityPeekCard}. */
export function AbilityPeek({ id, level, max, lang, children, className, disabled, stopRowActivation }: AbilityPeekProps) {
  const cap = max ?? ABILITY_LEVEL_MAX;
  const name = abilityName(id, lang);
  return (
    <PeekFrame
      kind="ability"
      label={level === undefined ? name : `${name}, ${level}/${cap}`}
      className={className}
      disabled={disabled}
      stopRowActivation={stopRowActivation}
      card={<AbilityPeekCard id={id} level={level} max={cap} lang={lang} />}
    >
      {children}
    </PeekFrame>
  );
}
