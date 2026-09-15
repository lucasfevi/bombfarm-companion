'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { BreakdownStatId, PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import type { TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { InfoTip, Panel, Tooltip, cn, numberFormatterFor, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';
import { heroCopyFor, type HeroCopy, type Lang, type StatPanelCopy } from '../copy';
import { derivedLabel, formatBreakdownValue, isSheetKey, rowValue } from '../model/breakdown-labels';
import {
  COMBAT_BREAKDOWN_CARDS,
  COMBAT_BREAKDOWN_ROWS,
  breakdownCardData,
  cardBadgesFor,
  connectedCards,
  matrixRowsFor,
  type BreakdownRowId,
} from '../model/combat-breakdown';
import { CombatBreakdownCard, type BreakdownText } from './combat-breakdown-card';
import { CombatBreakdownMatrix } from './combat-breakdown-matrix';
import { CombatBreakdownWires } from './combat-breakdown-wires';

const ROW_LABEL_KEY: Record<BreakdownRowId, keyof HeroCopy> = {
  sheet: 'heroDetailBreakdownRowSheet',
  factors: 'heroDetailBreakdownRowFactors',
  perHit: 'heroDetailBreakdownRowPerHit',
  dps: 'heroDetailBreakdownRowDps',
};

/** Each row's cards share one width, sized so the widest row fits the narrowest pipeline. */
const ROW_CARD_CLASS: Record<BreakdownRowId, string> = {
  sheet: '@min-[820px]:basis-[6.6rem] @min-[820px]:max-w-[8rem]',
  factors: '@min-[820px]:basis-[7.8rem] @min-[820px]:max-w-[9.5rem]',
  perHit: '@min-[820px]:basis-[9.4rem] @min-[820px]:max-w-[11rem]',
  dps: '@min-[820px]:basis-[10.5rem] @min-[820px]:max-w-[12rem]',
};

const groupHeadClass = 'm-0 text-[10px] font-bold tracking-[0.08em] text-accent uppercase';

/**
 * Where one hero's combat figures come from, drawn as a pipeline: the seven sheet stats feed the
 * factors, the factors feed the per-hit and cadence figures, and those feed the two DPS figures.
 * Every figure is visible without a click; the wires say which card reads which. Hovering or
 * focusing a card lights it with every card one wire away and mutes the rest.
 *
 * The panel's own width picks the layout. At 820px and up the cards sit in four centred rows
 * with the wires drawn between them; below that the same cards stack one per row under the same
 * four labels, and the wires are not drawn. Same figures, icons and popovers either way.
 *
 * Under the pipeline, the seven sheet stats again as a matrix — one row per stat, one column per
 * game line — which is where the pipeline's one-number sheet cards are taken apart.
 */
export function CombatBreakdownPanel({
  t,
  facts,
  hero,
  phase,
  switches,
  lang,
}: {
  t: StatPanelCopy;
  facts: PipelineFacts;
  hero: Pick<HeroRecord, 'abilities'>;
  phase: number;
  switches: TeamAuraSwitches;
  lang: Lang;
}) {
  const copy = heroCopyFor(lang);
  const formatNumber = useMemo(() => numberFormatterFor(lang), [lang]);
  const [lit, setLit] = useState<BreakdownStatId | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const cardElements = useRef(new Map<BreakdownStatId, HTMLElement>());
  const cardRefFor = useMemo(
    () =>
      new Map(
        COMBAT_BREAKDOWN_CARDS.map((id) => [
          id,
          (element: HTMLElement | null) => {
            if (element) cardElements.current.set(id, element);
            else cardElements.current.delete(id);
          },
        ]),
      ),
    [],
  );

  const badges = useMemo(() => cardBadgesFor(hero, phase, switches), [hero, phase, switches]);
  const matrixRows = useMemo(() => matrixRowsFor(facts, hero, switches), [facts, hero, switches]);
  const label = useCallback(
    (id: BreakdownStatId) => (isSheetKey(id) ? t.statFull[id] : derivedLabel(t, id)),
    [t],
  );
  const text = useMemo<BreakdownText>(() => ({ t, copy, lang, formatNumber }), [t, copy, lang, formatNumber]);
  const litCards = useMemo(() => (lit ? connectedCards(lit) : null), [lit]);

  return (
    <Panel className="@container min-w-0" data-testid="combat-breakdown">
      <Tooltip.Provider delay={200} closeDelay={100}>
        <div className={panelHClass}>
          <span className="flex items-center gap-1.5">
            <h2 className={panelTitleClass}>{t.panelEffective}</h2>
            <InfoTip label={t.panelEffective} tip={t.effectiveTip} />
          </span>
        </div>
        <p className={tipClass}>{copy.heroDetailBreakdownHint}</p>
        <div ref={rowsRef} className="relative flex flex-col gap-3 @min-[820px]:gap-7" data-testid="breakdown-pipeline">
          <CombatBreakdownWires containerRef={rowsRef} cards={cardElements} lit={lit} />
          {COMBAT_BREAKDOWN_ROWS.map((row) => (
            <section key={row.id} className="relative flex flex-col gap-1.5" data-breakdown-row={row.id}>
              <h3 className={groupHeadClass}>{copy[ROW_LABEL_KEY[row.id]]}</h3>
              <div className="flex flex-col gap-1.5 @min-[820px]:flex-row @min-[820px]:justify-center @min-[820px]:gap-2">
                {row.cards.map((id) => (
                  <div key={id} className={cn('flex min-w-0 flex-col @min-[820px]:shrink @min-[820px]:grow', ROW_CARD_CLASS[row.id])}>
                    <CombatBreakdownCard
                      card={breakdownCardData(id, facts, hero, switches, badges, label, lang)}
                      label={label(id)}
                      value={formatBreakdownValue(id, rowValue(id, facts), formatNumber)}
                      text={text}
                      lit={litCards?.has(id) ?? false}
                      muted={litCards !== null && !litCards.has(id)}
                      onLit={setLit}
                      cardRef={cardRefFor.get(id)!}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <h3 className={cn(groupHeadClass, 'mt-5 mb-1.5')}>{copy.heroDetailBreakdownMatrixTitle}</h3>
        <CombatBreakdownMatrix rows={matrixRows} t={t} copy={copy} formatNumber={formatNumber} />
      </Tooltip.Provider>
    </Panel>
  );
}
