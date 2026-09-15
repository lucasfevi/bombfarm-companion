'use client';

import { abilityEffectText, abilityName, heroLevelLabel } from '@bombfarm/domain/game-labels';
import type { AbilityGain, AbilityGainState } from '@bombfarm/domain/ability-gain';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { AbilityIcon } from '@bombfarm/game-art';
import {
  AbilityCard,
  Button,
  Panel,
  RankControl,
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
  abilityPanelReading,
  abilityPointReadoutFor,
  abilityRowsFor,
  abilityStepAvailability,
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
 * The callbacks a host supplies to make the panel editable. Absent, the same figures render with
 * no way to change them — see `abilityPanelReading`.
 *
 * The three strings ride along rather than living in this package's dictionary because each is
 * vocabulary its host already prints elsewhere: Reset labels a control on several other panels,
 * the level abbreviation is the game's own and appears on every item row, and the guidance
 * paragraph cross-references the host's neighbouring panels by name.
 */
export type AbilityPanelEditing = {
  onAbilityLevel: (abilityId: string, next: number) => void;
  onReset: () => void;
  resetLabel: string;
  levelAbbrev: string;
  tip: string;
};

/**
 * What this hero's abilities do, where its next ability point is worth spending, and — for a host
 * that asks for it — the steppers that spend it.
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
  editing,
}: {
  hero: HeroRecord;
  abilityGains: readonly AbilityGain[];
  t: HeroCopy;
  lang: Lang;
  editing?: AbilityPanelEditing | undefined;
}) {
  const reading = abilityPanelReading({ editable: !!editing });
  const availability = abilityPanelAvailability(abilityGains);
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

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        {/* One group, so the header's `justify-between` sees the heading and the Reset button
            rather than stranding the figure in the middle of the bar. */}
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className={panelTitleClass}>{t.heroDetailAbilitiesTitle}</h2>
          <span className={cn(numericClass, 'text-xs text-muted')}>
            {sub(t.heroDetailAbilitiesPointsValue, {
              spent: formatNumber(points.spent, lang, 0),
              budget: formatNumber(points.spendable, lang, 0),
            })}
          </span>
        </div>
        {reading.showReset && editing ? (
          <Button type="button" onClick={editing.onReset}>
            {editing.resetLabel}
          </Button>
        ) : null}
      </div>

      {editing === undefined ? null : <p className={tipClass}>{editing.tip}</p>}

      {availability.kind === 'unavailable' ? (
        <p className={tipClass}>{t.heroDetailAbilitiesNone}</p>
      ) : (
        <div className={cn(abilGridClass, 'mt-3')}>
          {rows.map((row) => {
            const name = abilityName(row.abilityId, lang);
            const step = abilityStepAvailability({
              level: row.level,
              max: row.max,
              spent: points.spent,
              budget: points.spendable,
            });
            return (
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
                      {name}
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
                {reading.showRankControls && editing ? (
                  <RankControl
                    className="mt-2"
                    value={row.level}
                    max={row.max}
                    label={name}
                    lvLabel={editing.levelAbbrev}
                    disabledDec={!step.canDecrease}
                    disabledInc={!step.canIncrease}
                    onChange={(next) => {
                      editing.onAbilityLevel(row.abilityId, next);
                    }}
                  />
                ) : null}
              </AbilityCard>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
