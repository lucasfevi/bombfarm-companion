'use client';

import { Panel, StatList } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { sub } from '@/shared/i18n';
import { formatClearTime } from '../model/phases-page';
import type { HeroPhaseFit } from '@bombfarm/domain/phase-intel';
import type { HeroRecord } from '@/shared/lib/storage';
import { PhasesHeroSwitcher } from './phases-hero-switcher';
import { PhasesHeroFitTable } from './phases-hero-fit-table';

export function PhasesHeroPanel({
  heroes,
  hero,
  heroFit,
  onSelectHero,
}: {
  heroes: HeroRecord[];
  hero: HeroRecord;
  heroFit: HeroPhaseFit | null;
  onSelectHero: (h: HeroRecord) => void;
}) {
  const { t, lang } = useAppLang();

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesHeroSection}</h2>
      </div>
      <p className={tipClass}>{t.phasesHeroTip}</p>
      <PhasesHeroSwitcher
        t={t}
        lang={lang}
        heroes={heroes}
        hero={hero}
        formatNumber={formatNumber}
        onSelectHero={onSelectHero}
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
                  sub(t.phasesPenShort, { gap: formatNumber(heroFit.penGap, 1) })
                ),
              },
              {
                id: 'normalHit',
                label: t.phasesNormalHit,
                value: formatNumber(heroFit.normalHit, 0),
              },
              {
                id: 'critHit',
                label: t.phasesCritHit,
                value: formatNumber(heroFit.critHit, 0),
              },
              {
                id: 'avgHit',
                label: t.phasesAvgHit,
                value: formatNumber(heroFit.avgHit, 0),
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
