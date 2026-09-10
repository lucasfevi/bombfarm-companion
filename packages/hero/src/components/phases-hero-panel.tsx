'use client';

import { useMemo, type ReactNode } from 'react';

import {
  Panel,
  StatList,
  cn,
  formatNumber,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui';
import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { heroCopyFor, sub } from '../copy';
import type { PhaseSelection } from '../core';
import {
  combatFiguresShown,
  formatClearTime,
  fuseNote,
  fuseReadoutFor,
  penetrationNote,
  penetrationReadingFor,
  propTableReadingFor,
  stageLabelFor,
  type CombatFigureId,
} from '../model';
import { useHeroCopy } from './hero-copy-context';
import { PhasesHeroSwitcherView, type HeroPickerSlot } from './phases-hero-switcher';
import { PhasesHeroFitTable } from './phases-hero-fit-table';

/** Hits, seconds and rates are all columns a player reads down, and the sans face this app ships
 *  has no tabular figures — so the mono face is what actually keeps the digits in line. */
const numericClass = 'font-mono tabular-nums';

/**
 * One hero against one stage, every figure read off a single `pipelineForHero` run.
 *
 * The labels this screen already prints come from the host dictionary in context; the fuse,
 * uptime, rate and stage vocabulary comes from this package's own dictionary, which owns it
 * precisely because no host prints it anywhere else.
 */
export function PhasesHeroPanel({
  heroes,
  hero,
  combat,
  phaseSelection,
  onSelectHero,
  renderPicker,
  breakdownShownElsewhere = false,
}: {
  heroes: HeroRecord[];
  hero: HeroRecord;
  combat: AdvisorPipelineResult | null;
  phaseSelection: PhaseSelection;
  onSelectHero: (h: HeroRecord) => void;
  renderPicker?: HeroPickerSlot | undefined;
  /** Set by a host that draws the per-statistic breakdown beside this panel: the eight figures
   *  that appear there too are dropped here, so each is stated once, where its ledger is. */
  breakdownShownElsewhere?: boolean | undefined;
}) {
  const { t, lang } = useHeroCopy();
  const detail = heroCopyFor(lang);
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

  const stage = stageLabelFor(phaseSelection, {
    farmScreen: detail.heroDetailCombatPhaseFromFarm,
    override: detail.heroDetailCombatPhaseOverridden,
  });

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesHeroSection}</h2>
      </div>
      <p className={tipClass}>{t.phasesHeroTip}</p>
      <p className={cn(tipClass, numericClass)}>
        {sub(detail.heroDetailCombatPhase, { name: formatNumber(stage.phase, lang, 0) })}
      </p>
      <p className={tipClass}>{stage.note}</p>
      <PhasesHeroSwitcherView
        t={t}
        lang={lang}
        heroes={heroes}
        hero={hero}
        formatNumber={boundFormatNumber}
        onSelectHero={onSelectHero}
        renderPicker={renderPicker}
      />
      {combat ? (
        <CombatFigures combat={combat} breakdownShownElsewhere={breakdownShownElsewhere} />
      ) : null}
    </Panel>
  );
}

function CombatFigures({
  combat,
  breakdownShownElsewhere,
}: {
  combat: AdvisorPipelineResult;
  breakdownShownElsewhere: boolean;
}) {
  const { t, lang } = useHeroCopy();
  const detail = heroCopyFor(lang);
  const fuse = fuseReadoutFor(combat);
  const penetration = penetrationReadingFor(combat);
  const props = propTableReadingFor(combat.propRows);

  const number = (value: number, digits: number) => (
    <span className={numericClass}>{formatNumber(value, lang, digits)}</span>
  );

  const shown = new Set(combatFiguresShown({ breakdownShownElsewhere }));
  const rows: { id: CombatFigureId; label: string; value: ReactNode }[] = [
    {
      id: 'pen',
      label: t.phasesPenetration,
      value: (
        <span className={penetration.kind === 'covered' ? 'text-up' : undefined}>
          {penetrationNote(penetration, {
            covered: t.phasesPenOk,
            short: (gapPct) =>
              sub(t.phasesPenShort, { gap: formatNumber(gapPct, lang, 1) }),
          })}
        </span>
      ),
    },
    {
      id: 'damageThrough',
      label: detail.heroDetailCombatDamageThrough,
      value: number(combat.mitF * 100, 1),
    },
    { id: 'normalHit', label: t.phasesNormalHit, value: number(combat.predHit, 0) },
    { id: 'critHit', label: t.phasesCritHit, value: number(combat.predCrit, 0) },
    { id: 'avgHit', label: t.phasesAvgHit, value: number(combat.avgHit, 0) },
    {
      id: 'fieldTime',
      label: t.phasesFieldTime,
      value: <span className={numericClass}>{formatClearTime(combat.fieldSecs)}</span>,
    },
    {
      id: 'fuse',
      label: detail.heroDetailCombatFuseTime,
      value: number(fuse.secs, 2),
    },
    {
      id: 'fuseFloor',
      label: detail.heroDetailCombatFuseFloor,
      value: number(fuse.floorSecs, 2),
    },
    {
      id: 'cdrCap',
      label: detail.heroDetailCombatCdrCeiling,
      value: number(fuse.capPct, 0),
    },
    {
      // `uptime` is already a percentage — `(100 * field) / (field + rest)` — so it is
      // printed, not scaled. Scaling it again read 4.495,4 for a hero on field 45% of
      // the time.
      id: 'uptime',
      label: detail.heroDetailCombatUptime,
      value: number(combat.uptime, 1),
    },
    {
      id: 'activeDps',
      label: detail.heroDetailCombatActiveDps,
      value: number(combat.active, 0),
    },
    {
      id: 'sustainedDps',
      label: detail.heroDetailCombatSustainedDps,
      value: number(combat.dps, 0),
    },
  ];

  return (
    <>
      <StatList items={rows.filter((row) => shown.has(row.id))} />
      <p className={tipClass}>
        {fuseNote(fuse, {
          atCeiling: detail.heroDetailCombatCdrCeilingReached,
          floor: (floorSecs) =>
            sub(detail.heroDetailCombatFuseFloorHint, {
              secs: formatNumber(floorSecs, lang, 2),
            }),
        })}
      </p>
      {props.kind === 'empty' ? (
        <p className={tipClass}>{detail.heroDetailCombatNoProps}</p>
      ) : (
        <PhasesHeroFitTable propRows={props.rows} />
      )}
    </>
  );
}
