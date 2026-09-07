'use client';

import { abilityEffectText, abilityName, heroLevelLabel } from '@bombfarm/domain/game-labels';
import type { AbilityGain, AbilityGainState } from '@bombfarm/domain/ability-gain';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { AbilityIcon } from '@bombfarm/game-art';
import {
  AbilityCard,
  Panel,
  StatList,
  abilEffectClass,
  abilGridClass,
  abilHeadClass,
  abilMetaClass,
  abilNameClass,
  abilTagClass,
  cn,
  formatNumber,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui';
import { sub, type HeroCopy, type Lang } from '../copy';
import {
  abilityPanelAvailability,
  abilityPointReadoutFor,
  abilityRowsFor,
  abilitySlotReadoutFor,
  deadPointNote,
} from '../model';

/** Gains and point counts are columns a player reads down, and the sans face this app ships has
 *  no tabular figures — so the mono face is what actually keeps the digits in line. */
const numericClass = 'font-mono tabular-nums';

const READING_CLASS: Record<AbilityGainState['kind'], string> = {
  gain: 'text-up',
  maxed: 'text-muted',
  notModelled: 'text-muted',
  auraAtCeiling: 'text-muted',
  notMeasured: 'text-muted',
  unavailable: 'text-muted',
};

/**
 * What this hero's abilities do, and where its next ability point is worth spending.
 *
 * Every judgement it prints is made by an exported function in `../model` and proved there; this
 * file only arranges the results. It takes `t`/`lang` as props rather than reading
 * `useHeroCopy()`, matching the identity panel beside it: none of this vocabulary is a string a
 * host already owns.
 */
export function HeroAbilitiesPanel({
  hero,
  abilityGains,
  t,
  lang,
}: {
  hero: HeroRecord;
  abilityGains: readonly AbilityGain[];
  t: HeroCopy;
  lang: Lang;
}) {
  const availability = abilityPanelAvailability(abilityGains);
  const slots = abilitySlotReadoutFor(hero);
  const points = abilityPointReadoutFor(hero);
  const rows = abilityRowsFor(abilityGains, {
    level: (level, max) =>
      sub(t.heroDetailAbilitiesLevelOfMax, {
        level: heroLevelLabel(level, lang),
        max: formatNumber(max, lang, 0),
      }),
    value: {
      gain: (gainPct) =>
        sub(t.heroDetailAbilitiesNextLevelGain, { pct: formatNumber(gainPct, lang, 2) }),
      maxed: t.heroDetailAbilitiesMaxed,
      notModelled: t.heroDetailAbilitiesNotModelled,
      auraAtCeiling: t.heroDetailAbilitiesAuraAtCeiling,
      notMeasured: t.heroDetailAbilitiesNotMeasured,
      unavailable: t.heroDetailAbilitiesNoBirthRoll,
    },
  });
  const deadNote = deadPointNote(points.dead, {
    none: t.heroDetailAbilitiesDeadPointsNone,
    atCeiling: t.heroDetailAbilitiesDeadPointsAtCeiling,
    dead: (count) =>
      sub(t.heroDetailAbilitiesDeadPointsHint, { count: formatNumber(count, lang, 0) }),
  });

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroDetailAbilitiesTitle}</h2>
      </div>

      <StatList
        items={[
          {
            id: 'slots',
            label: t.heroDetailAbilitiesSlots,
            value: (
              <span className={numericClass}>
                {sub(t.heroDetailAbilitiesSlotsValue, {
                  used: formatNumber(slots.used, lang, 0),
                  max: formatNumber(slots.quota, lang, 0),
                })}
              </span>
            ),
          },
          {
            id: 'points',
            label: t.heroDetailAbilitiesPoints,
            value: (
              <span className={numericClass}>
                {sub(t.heroDetailAbilitiesPointsValue, {
                  spent: formatNumber(points.spent, lang, 0),
                  budget: formatNumber(points.spendable, lang, 0),
                })}
              </span>
            ),
          },
          {
            id: 'dead',
            label: t.heroDetailAbilitiesDeadPoints,
            value: <span className={numericClass}>{formatNumber(points.dead.count, lang, 0)}</span>,
          },
        ]}
      />
      <p className={tipClass}>{deadNote}</p>

      {availability.kind === 'unavailable' ? (
        <p className={tipClass}>{t.heroDetailAbilitiesNone}</p>
      ) : (
        <div className={cn(abilGridClass, 'mt-3')}>
          {rows.map((row) => (
            <AbilityCard
              key={row.abilityId}
              selected={row.spent}
              onSheet={row.onSheet}
              lockedOut={false}
            >
              <div className={abilHeadClass}>
                <AbilityIcon
                  code={row.abilityId}
                  size="xl"
                  level={row.level}
                  max={row.max}
                  className="shrink-0 self-start"
                />
                <div className={abilMetaClass}>
                  <span className={abilNameClass}>
                    {abilityName(row.abilityId, lang)}
                    {row.onSheet ? (
                      <em className={abilTagClass}>{t.heroDetailAbilitiesOnSheetTag}</em>
                    ) : null}
                  </span>
                  <span className={cn('text-[11px] leading-1.3 text-muted', numericClass)}>
                    {row.levelText}
                  </span>
                  <span className={abilEffectClass}>{abilityEffectText(row.abilityId, lang)}</span>
                </div>
              </div>
              <p className={cn('mt-auto text-[11px] leading-1.3', READING_CLASS[row.reading])}>
                {row.valueText}
              </p>
            </AbilityCard>
          ))}
        </div>
      )}
    </Panel>
  );
}
