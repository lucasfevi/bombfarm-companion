'use client';

import { Tooltip, cn, formatNumber } from '@bombfarm/ui';
import { useAppLang } from '@/shared/context/app-lang';
import { sub, type Strings } from '@/shared/i18n';
import { selectFarmReturnBonus, usePlannerStore, type PlannerStore } from '@/shared/stores';
import { selectFarmCardRows } from '../model/farm-card-view';
import { buildFarmSentence, formatSignedPct } from '../model/farm-sentence';
import { selectAccountUsable, selectHasRoster } from '../model/home-selectors';
import { FarmPhaseTile } from './farm-phase-tile';
import { HomeSectionCard } from './home-section-card';

const RETURN_BONUS_KEY = {
  off: 'farmRankingReturnBonusOff',
  on: 'farmRankingReturnBonusOn',
  vip: 'farmRankingReturnBonusVip',
} as const satisfies Record<PlannerStore['farmReturnBonus'], keyof Strings>;

const PILL_TONE_CLASS = {
  up: 'text-up',
  down: 'text-warn',
  neutral: 'text-muted',
} as const;

export function FarmCard() {
  const { t, lang } = useAppLang();
  const view = usePlannerStore(selectFarmCardRows);
  const hasRoster = usePlannerStore(selectHasRoster);
  const accountUsable = usePlannerStore(selectAccountUsable);
  const returnBonus = usePlannerStore(selectFarmReturnBonus);
  const { currentRow, bestRow, pushTargetRow } = view;
  const ready = hasRoster && accountUsable && currentRow != null && bestRow != null;

  const sentence = buildFarmSentence(view.sentence, t, lang);
  const pushLine =
    pushTargetRow && bestRow
      ? sub(t.homeCardFarmFooterPush, {
          phase: pushTargetRow.phase,
          pct: formatNumber(
            ((pushTargetRow.goldPerHour - bestRow.goldPerHour) / bestRow.goldPerHour) * 100,
            lang,
            1,
          ),
        })
      : null;

  return (
    <HomeSectionCard
      section="farm"
      state={ready ? 'ready' : 'needs'}
      context={t.homeCardFarmContext}
      footer={
        ready ? (
          <>
            <p className="m-0">{t.homeCardFarmFooterRanked}</p>
            {pushLine ? <p className="m-0">{pushLine}</p> : null}
            <p className="m-0">
              {t.farmRankingReturnBonusLabel} {t[RETURN_BONUS_KEY[returnBonus]]}
            </p>
          </>
        ) : (
          t.homeCardFarmNeeds
        )
      }
    >
      {currentRow && bestRow ? (
        <Tooltip.Provider delay={200} closeDelay={80}>
          <div className="grid grid-cols-1 items-center gap-3 min-[720px]:grid-cols-[1fr_auto_1fr]">
            <FarmPhaseTile
              row={currentRow}
              title={t.homeCardFarmCurrent}
              barPercent={view.barPercent.current}
              variant="fill"
              testId="home-farm-current"
            />
            <p
              className={cn('m-0 text-center font-mono text-sm font-bold tabular-nums', PILL_TONE_CLASS[view.pill.tone])}
              data-testid="home-farm-pill"
              data-tone={view.pill.tone}
            >
              {view.pill.pct == null ? t.homeCardFarmSame : formatSignedPct(view.pill.pct, lang)}
            </p>
            <FarmPhaseTile
              row={bestRow}
              title={t.homeCardFarmBest}
              barPercent={view.barPercent.best}
              variant="best"
              testId="home-farm-best"
            />
          </div>
          {sentence ? (
            <p className="m-0 mt-3 text-sm" data-testid="home-farm-sentence">
              {sentence}
            </p>
          ) : null}
        </Tooltip.Provider>
      ) : null}
    </HomeSectionCard>
  );
}
