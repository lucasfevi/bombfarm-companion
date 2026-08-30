'use client';

import { useMemo } from 'react';

import { SLOTS, sumGearBonuses, type GearBonuses } from '@bombfarm/domain/gear';
import { itemsEqual } from '@bombfarm/domain/loadout';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber, numberFormatterFor } from '@/shared/lib/format-number';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';
import { useHeroBuildActions } from '../hooks/use-hero-build-actions';
import { Button, MetricScoreboard, type MetricScoreboardCell } from '@bombfarm/ui';
import {
  heroAbilHClass,
  heroAbilTitleClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';
import { SlotEditor, slotsGridClass } from '@/features/gear';
import { GearSlotStatsGrid } from './gear-slot-stats-grid';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { maskRevealStyle } from '@/shared/lib/mask-reveal';
import { GearTotalsTable } from './gear-totals-table';

const compareRevealTransition = { duration: 0.4, ease: 'easeInOut' as const };

/** Compare header + actions + alt-loadout grid + totals/scoreboard for the Items panel. */
export function GearCompareSection() {
  const { t, lang } = useAppLang();
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);
  const { setAltSlot, clearCompare, copyGear, applyAltGear } = useHeroBuildActions();

  const loadout = usePlannerStore((state) => state.loadout);
  const altLoadout = usePlannerStore((state) => state.altLoadout);

  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const { B, dps, predHit, bDiff, bHitDiff } = pipeline;

  const onPatchAltSlot = setAltSlot;
  const onApplyAltGear = applyAltGear;
  const onCopyGear = copyGear;
  const onClearCompare = clearCompare;

  const hasGear = SLOTS.some((slot) => loadout[slot] != null);
  const gearBonuses = sumGearBonuses(loadout);
  const altGearBonuses: GearBonuses | null = altLoadout ? sumGearBonuses(altLoadout) : null;
  const comparing = Boolean(B && altLoadout && altGearBonuses);

  const metricCells: MetricScoreboardCell[] | null = B
    ? [
        {
          id: 'dps-current',
          label: `${t.metricSustained} · ${t.compareCurrent}`,
          value: formatNumber(dps, lang, 0),
          tone: 'ink',
        },
        {
          id: 'hit-current',
          label: `${t.compareHit} · ${t.compareCurrent}`,
          value: formatNumber(predHit, lang, 0),
          tone: 'ink',
        },
        {
          id: 'dps-clone',
          label: `${t.metricSustained} · ${t.compareAlt}`,
          value: formatNumber(B.dps, lang, 0),
          tone: 'accent',
          delta: `${bDiff >= 0 ? '+' : ''}${formatNumber(bDiff, lang, 1)}%`,
          deltaTone: bDiff >= 0 ? 'up' : 'down',
        },
        {
          id: 'hit-clone',
          label: `${t.compareHit} · ${t.compareAlt}`,
          value: formatNumber(B.hit, lang, 0),
          tone: 'accent',
          delta: `${bHitDiff >= 0 ? '+' : ''}${formatNumber(bHitDiff, lang, 1)}%`,
          deltaTone: bHitDiff >= 0 ? 'up' : 'down',
        },
      ]
    : null;
  const metricsAriaLabel = `${t.metricSustained} · ${t.compareHit}`;

  return (
    <>
      {hasGear && (
        <MotionConfig reducedMotion="user">
          <section
            className="mx-auto mt-6 w-full min-w-0 max-w-5xl"
            aria-label={t.gearTotals}
          >
            <GearTotalsTable
              current={gearBonuses}
              clone={comparing && altGearBonuses ? altGearBonuses : undefined}
              t={t}
              formatNumber={boundFormatNumber}
            />
            <AnimatePresence initial={false}>
              {comparing && B && altGearBonuses && (
                <motion.div
                  key="compare-metrics"
                  className="overflow-hidden"
                  initial={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 8 }}
                  animate={{ height: 'auto', opacity: 1, '--mask-stop': '100%', y: 0 }}
                  exit={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 8 }}
                  transition={compareRevealTransition}
                  style={maskRevealStyle}
                >
                  <MetricScoreboard cells={metricCells!} aria-label={metricsAriaLabel} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </MotionConfig>
      )}

      <MotionConfig reducedMotion="user">
        <div className={heroAbilHClass}>
          <h3 className={heroAbilTitleClass}>{t.panelCompare}</h3>
          <AnimatePresence initial={false}>
            {B && (
              <motion.div
                key="compare-actions"
                className="flex flex-wrap items-center gap-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <Button type="button" variant="primary" onClick={onApplyAltGear}>
                  {t.applyCompare}
                </Button>
                <Button type="button" onClick={onCopyGear}>
                  {t.reCopy}
                </Button>
                <Button type="button" variant="ghost" onClick={onClearCompare}>
                  {t.clearCompare}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {!B || !altLoadout ? (
            <motion.div
              key="compare-empty"
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 10 }}
              animate={{ height: 'auto', opacity: 1, '--mask-stop': '100%', y: 0 }}
              exit={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 10 }}
              transition={compareRevealTransition}
              style={maskRevealStyle}
            >
              <p className={tipClass}>{t.compareTip}</p>
              <Button type="button" variant="primary" onClick={onCopyGear}>
                {t.copyGear}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="compare-active"
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 10 }}
              animate={{ height: 'auto', opacity: 1, '--mask-stop': '100%', y: 0 }}
              exit={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 10 }}
              transition={compareRevealTransition}
              style={maskRevealStyle}
            >
              {!hasGear && (
                <MetricScoreboard cells={metricCells!} aria-label={metricsAriaLabel} />
              )}
              <div className={slotsGridClass}>
                {SLOTS.map((slot) => {
                  const current = loadout[slot];
                  const alt = altLoadout[slot];
                  const changed = !itemsEqual(current, alt);
                  return (
                    <SlotEditor
                      key={slot}
                      slot={slot}
                      equipped={alt}
                      changed={changed}
                      t={t}
                      lang={lang}
                      onPatch={onPatchAltSlot}
                    />
                  );
                })}
              </div>
              <GearSlotStatsGrid loadout={altLoadout} t={t} formatNumber={boundFormatNumber} />
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </>
  );
}
