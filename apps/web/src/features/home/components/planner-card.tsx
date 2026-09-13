'use client';

import { formatPhaseLabel } from '@bombfarm/farm/model/farm-ranking-format';
import { DataTable, Tooltip } from '@bombfarm/ui';
import { FIELD_LABEL_KEY } from '@/features/account';
import { useAppLang } from '@/shared/context/app-lang';
import { sub } from '@/shared/i18n';
import {
  selectCurrentPhase,
  selectHeroes,
  selectPhasesViewPhaseChosen,
  usePlannerStore,
} from '@/shared/stores';
import { selectHasRoster, selectMissingFieldsToName } from '../model/home-selectors';
import { HOME_RANKING_LIMIT, selectHomeRankingRows } from '../model/planner-card-ranking';
import { HomeSectionCard } from './home-section-card';
import { PlannerCardRow } from './planner-card-row';

export function PlannerCard() {
  const { t, lang } = useAppLang();
  const rows = usePlannerStore(selectHomeRankingRows);
  const heroes = usePlannerStore(selectHeroes);
  const phase = usePlannerStore(selectCurrentPhase);
  const phaseChosen = usePlannerStore(selectPhasesViewPhaseChosen);
  const missingFields = usePlannerStore(selectMissingFieldsToName);
  const hasRoster = usePlannerStore(selectHasRoster);

  const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
  const phaseLabel = formatPhaseLabel(phase, lang);
  const firstLine =
    missingFields.length > 0
      ? sub(t.homeCardPlannerMissingFields, {
          fields: missingFields.map((field) => t[FIELD_LABEL_KEY[field]]).join(', '),
        })
      : phaseChosen
        ? sub(t.homeCardPlannerFooterChosen, { phase: phaseLabel })
        : sub(t.homeCardPlannerFooterAccount, { phase: phaseLabel });
  const moreCount = heroes.length - HOME_RANKING_LIMIT;

  return (
    <HomeSectionCard
      section="planner"
      state={hasRoster ? 'ready' : 'needs'}
      context={sub(t.homeCardPlannerContext, { count: HOME_RANKING_LIMIT })}
      footer={
        hasRoster ? (
          <>
            <p className="m-0">{firstLine}</p>
            {moreCount > 0 ? (
              <p className="m-0">{sub(t.homeCardPlannerMore, { count: moreCount })}</p>
            ) : null}
          </>
        ) : (
          t.homeCardPlannerNeedsHeroes
        )
      }
    >
      <Tooltip.Provider delay={200} closeDelay={80}>
        <DataTable.Root className="overflow-x-auto">
          <DataTable.Table>
            <DataTable.Head>
              <DataTable.Row>
                <DataTable.Header>
                  <span className="sr-only">{t.homeCardPlannerColHero}</span>
                </DataTable.Header>
                <DataTable.Header align="right">{t.homeCardPlannerColPower}</DataTable.Header>
                <DataTable.Header align="right">{t.homeCardPlannerColDps}</DataTable.Header>
                <DataTable.Header>{t.rosterColAbilities}</DataTable.Header>
              </DataTable.Row>
            </DataTable.Head>
            <DataTable.Body>
              {rows.flatMap((row) => {
                const hero = heroById.get(row.heroId);
                return hero ? [<PlannerCardRow key={row.heroId} hero={hero} dps={row.dps} lang={lang} />] : [];
              })}
            </DataTable.Body>
          </DataTable.Table>
        </DataTable.Root>
      </Tooltip.Provider>
    </HomeSectionCard>
  );
}
