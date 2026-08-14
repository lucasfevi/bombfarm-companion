/**
 * The selected hero's detail (design.md §7.2, MPV-02/04/09/13). Selection changes this area
 * without a page transition and without re-reading the account (`PlanningView` never calls
 * `useAccountView` more than once; this component only reads the already-built `PlanningModel`).
 */
import { Num, Panel, StatList } from '@bombfarm/ui';
import { isQuantityUsable, withheldSections } from '../../lib/planning/account-model';
import { adviceForHero } from '../../lib/planning/hero-advice';
import { useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { PlanningModel } from '../../lib/planning/types';
import { WithheldNotice } from './withheld-notice';

export function HeroDetail({ model, heroId }: { model: PlanningModel; heroId: string | null }) {
  const t = useCopy();
  const { locale } = useLocale();
  const entry = heroId ? model.heroes.find((candidate) => candidate.hero.id === heroId) : undefined;

  if (!entry) {
    return (
      <Panel data-testid="hero-detail">
        <p className="m-0 text-sm text-muted">{t.planningSelectHeroPrompt}</p>
      </Panel>
    );
  }

  const advice = adviceForHero(model, entry.hero.id);
  const gearUsable = isQuantityUsable(model.sections, 'gearSummary');
  const equippedCount = Object.values(entry.hero.loadout).filter((slot) => slot != null).length;

  const dpsValue = advice.withheld ? (
    <WithheldNotice quantity="dps" sections={advice.sections} />
  ) : (
    // Read-only display: onChange is a no-op (the desktop never writes account data, D24) — Num
    // is the shipped composite numeric field (`base-ui-first.md`), reused here for its display
    // chrome rather than invented as a one-off read-only number.
    <Num value={advice.dps} onChange={() => {}} decimals={0} />
  );

  const gearValue = gearUsable ? (
    formatCount(equippedCount, locale)
  ) : (
    <WithheldNotice quantity="gearSummary" sections={withheldSections(model.sections, 'gearSummary')} />
  );

  const resetValue = advice.withheld ? (
    <WithheldNotice quantity="resetAdvice" sections={advice.sections} />
  ) : advice.resetAdvice.recommend ? (
    t.adviceResetAdviceRecommended
  ) : (
    t.adviceResetAdviceNotRecommended
  );

  return (
    <Panel data-testid="hero-detail">
      <h2 data-testid="hero-detail-name" className="text-base font-semibold text-ink">
        {entry.hero.name}
      </h2>
      <StatList
        aria-label={entry.hero.name}
        items={[
          { id: 'dps', label: t.adviceDpsLabel, value: dpsValue },
          { id: 'gear', label: t.planningGearSummaryLabel, value: gearValue },
          { id: 'reset', label: t.adviceNextPointTitle, value: resetValue },
        ]}
      />
    </Panel>
  );
}
