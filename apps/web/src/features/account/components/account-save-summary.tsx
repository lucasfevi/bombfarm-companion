'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { houseLabel } from '@bombfarm/domain/game-labels';
import { splitHouseRest } from '@bombfarm/domain/model';
import { Panel } from '@bombfarm/ui';
import { formatNumber } from '@/shared/lib/format-number';
import {
  usePlannerStore,
  selectFieldSlots,
  selectHouseCycleSecs,
  selectHouseCycleSecsHouseIdx,
  selectHouseCycleSecsLevel,
  selectMaxPhase,
  selectSlots,
  selectTreeLuckFlatPct,
  selectTreeXpMult,
} from '@/shared/stores';
import {
  importAccountBlockClass,
  importAccountGridClass,
  panelHClass,
  panelTitleClass,
  statListClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';

const EM_DASH = '—';

/**
 * Account-wide facts the save carries that no other surface renders. Deliberately does NOT
 * repeat what {@link AccountColumn} already shows (the House picker, the farm phase, the skill
 * tree's combat multipliers) — this panel is the gap: progression, the two slot counts, and the
 * two tree bonuses that feed the Phases board rather than DPS.
 *
 * Every value here is read-only and import-sourced; a field with no imported value renders an
 * em dash rather than a plausible default, so "never imported" stays distinguishable from
 * "imported as zero".
 */
export function AccountSaveSummary() {
  const { t, lang } = useAppLang();
  const maxPhase = usePlannerStore(selectMaxPhase);
  const fieldSlots = usePlannerStore(selectFieldSlots);
  const slots = usePlannerStore(selectSlots);
  const houseCycleSecs = usePlannerStore(selectHouseCycleSecs);
  const cycleHouseIdx = usePlannerStore(selectHouseCycleSecsHouseIdx);
  const cycleLevel = usePlannerStore(selectHouseCycleSecsLevel);
  const luckFlatPct = usePlannerStore(selectTreeLuckFlatPct);
  const xpMult = usePlannerStore(selectTreeXpMult);

  const capturedCycle = houseCycleSecs != null ? splitHouseRest(houseCycleSecs) : null;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.accountSavePanel}</h2>
      </div>
      <p className={tipClass}>{t.accountSaveTip}</p>

      <div className={importAccountGridClass}>
        <section className={importAccountBlockClass} aria-label={t.accountSaveProgress}>
          <h3>{t.accountSaveProgress}</h3>
          <dl className={statListClass}>
            <div>
              <dt>{t.accountMaxPhase}</dt>
              <dd>{maxPhase != null ? maxPhase : EM_DASH}</dd>
            </div>
            <div>
              <dt>{t.accountLuckFlat}</dt>
              <dd>+{formatNumber(luckFlatPct, 2)} pp</dd>
            </div>
            <div>
              <dt>{t.treeXpMult}</dt>
              <dd>×{formatNumber(xpMult, 2)}</dd>
            </div>
          </dl>
        </section>

        <section className={importAccountBlockClass} aria-label={t.accountSaveRotation}>
          <h3>{t.accountSaveRotation}</h3>
          <dl className={statListClass}>
            <div>
              <dt>{t.accountFieldSlots}</dt>
              <dd>{fieldSlots != null ? fieldSlots : EM_DASH}</dd>
            </div>
            <div>
              <dt>{t.accountCasaSlots}</dt>
              <dd>{slots}</dd>
            </div>
            <div>
              <dt>{t.accountSaveHouseCycle}</dt>
              <dd>
                {capturedCycle
                  ? `${capturedCycle.minutes} min ${capturedCycle.seconds} s`
                  : EM_DASH}
              </dd>
            </div>
            {capturedCycle && cycleHouseIdx != null ? (
              <div>
                <dt>{t.accountSaveHouseCycleAt}</dt>
                <dd>
                  {houseLabel(cycleHouseIdx, lang)} · {t.houseLvl} {cycleLevel ?? EM_DASH}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </Panel>
  );
}
