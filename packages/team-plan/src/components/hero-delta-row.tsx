'use client';

import { memo } from 'react';
import type { TeamPlan, TeamPlanPerHeroRow } from '@bombfarm/domain/team-plan/types';
import { Accordion } from '@bombfarm/ui';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { sub, type Lang } from '@bombfarm/hero/copy';
import { HeroIdentityChip } from '@bombfarm/game-art';
import { shortHeroRecordId } from '@bombfarm/domain/shims/hero-identity';
import type { TeamPlanScreenCopy } from '../copy';
import { pointsResetView } from '../model/points-reset-view';
import { AbbreviatedNumber } from './abbreviated-number';
import { HeroDetailPanel } from './hero-detail-panel';
import type { HeroGearFlow } from './hero-proposed-gear';

const metricLabelClass = 'text-[9px] font-bold leading-none tracking-[0.06em] text-muted uppercase';
const metricValueClass = 'font-mono text-[13px] font-semibold leading-none tabular-nums';

export type HeroDeltaRoster = {
  heroByScopeKey: Map<string, HeroRecord>;
  heroNameFallback: (heroId: string) => string;
};

/**
 * It is written out by hand rather than left to the React Compiler, which does not run over a
 * package a host lists in `transpilePackages` — so a component that reaches a host this way keeps
 * only the memoisation its own source spells. One row per hero in the plan: `roster` and `gear`
 * are built once by the table under `useMemo`, so a shallow compare here bails out for every
 * sibling row whose own hero did not change.
 */
export const HeroDeltaRow = memo(function HeroDeltaRow({
  t,
  lang,
  plan,
  row,
  roster,
  gear,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  plan: TeamPlan;
  row: TeamPlanPerHeroRow;
  roster: HeroDeltaRoster;
  gear: HeroGearFlow;
}) {
  const hero = roster.heroByScopeKey.get(row.heroId);
  const disambiguatedName = hero
    ? sub(t.teamPlanHeroRowLabel, {
        name: row.heroName,
        level: String(row.level),
        id: shortHeroRecordId(hero),
      })
    : row.heroName;
  const pointsReset = pointsResetView(plan, row);

  return (
    <Accordion.Item value={row.heroId}>
      <Accordion.Trigger
        tone="row"
        aria-label={sub(t.teamPlanHeroDeltaExpandAria, { name: disambiguatedName })}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <HeroIdentityChip hero={hero} fallbackName={row.heroName} lang={lang} />
          <div className="ml-auto flex items-center gap-3">
            <div className="flex flex-col items-end gap-0.5">
              <span className={metricLabelClass}>{t.teamPlanColBefore}</span>
              <AbbreviatedNumber value={row.before} lang={lang} className={metricValueClass} disableFocus />
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={metricLabelClass}>{t.teamPlanColAfter}</span>
              <AbbreviatedNumber value={row.after} lang={lang} className={metricValueClass} disableFocus />
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={metricLabelClass}>{t.teamPlanColDelta}</span>
              <AbbreviatedNumber
                lang={lang}
                value={row.delta}
                signed
                disableFocus
                className={`${metricValueClass} ${row.delta < 0 ? 'text-down' : row.delta > 0 ? 'text-up' : ''}`}
              />
            </div>
          </div>
        </div>
      </Accordion.Trigger>
      <Accordion.Panel>
        <HeroDetailPanel
          t={t}
          lang={lang}
          stats={{
            sheetBefore: row.sheetStatsBefore,
            sheetAfter: row.sheetStatsAfter,
            combatBefore: row.combatStatsBefore,
            combatAfter: row.combatStatsAfter,
            hitBefore: row.hitBefore,
            hitAfter: row.hitAfter,
          }}
          gear={gear}
          heroByScopeKey={roster.heroByScopeKey}
          heroNameFallback={roster.heroNameFallback}
          pointsReset={pointsReset}
        />
      </Accordion.Panel>
    </Accordion.Item>
  );
});
