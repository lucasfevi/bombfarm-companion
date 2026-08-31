'use client';

import { useMemo } from 'react';

import {
  Panel,
  StatList,
  formatNumber,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui';
import type { HeroPhaseFit } from '@bombfarm/domain/phase-intel';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { sub } from '../copy';
import { formatClearTime } from '../model/phases-page';
import { useFarmCopy } from './farm-copy-context';
import { PhasesHeroSwitcherView, type HeroPickerSlot } from './phases-hero-switcher';
import { PhasesHeroFitTable } from './phases-hero-fit-table';

export function PhasesHeroPanel({
  heroes,
  hero,
  heroFit,
  onSelectHero,
  renderPicker,
}: {
  heroes: HeroRecord[];
  hero: HeroRecord;
  heroFit: HeroPhaseFit | null;
  onSelectHero: (h: HeroRecord) => void;
  renderPicker?: HeroPickerSlot;
}) {
  const { t, lang } = useFarmCopy();
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesHeroSection}</h2>
      </div>
      <p className={tipClass}>{t.phasesHeroTip}</p>
      <PhasesHeroSwitcherView
        t={t}
        lang={lang}
        heroes={heroes}
        hero={hero}
        formatNumber={boundFormatNumber}
        onSelectHero={onSelectHero}
        renderPicker={renderPicker}
      />
      {heroFit ? (
        <>
          <StatList
            items={[
              {
                id: 'pen',
                label: t.phasesPenetration,
                value: heroFit.penOk ? (
                  <span className="text-up">{t.phasesPenOk}</span>
                ) : (
                  sub(t.phasesPenShort, { gap: formatNumber(heroFit.penGap, lang, 1) })
                ),
              },
              {
                id: 'normalHit',
                label: t.phasesNormalHit,
                value: formatNumber(heroFit.normalHit, lang, 0),
              },
              {
                id: 'critHit',
                label: t.phasesCritHit,
                value: formatNumber(heroFit.critHit, lang, 0),
              },
              {
                id: 'avgHit',
                label: t.phasesAvgHit,
                value: formatNumber(heroFit.avgHit, lang, 0),
              },
              {
                id: 'fieldTime',
                label: t.phasesFieldTime,
                value: formatClearTime(heroFit.fieldSecs),
              },
            ]}
          />
          <PhasesHeroFitTable propHits={heroFit.propHits} />
        </>
      ) : null}
    </Panel>
  );
}
