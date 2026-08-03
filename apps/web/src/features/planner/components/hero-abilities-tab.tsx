'use client';

import { isSheetAbility, ABILITY_QUOTA, abilityPointBudget } from '@bombfarm/domain/model';
import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore } from '@/shared/stores';
import { abilitiesForHeroOrdered, heroAbilitySlotsUsed } from '@bombfarm/domain/hero-abilities';
import { useHeroBuildActions } from '../hooks/use-hero-build-actions';
import { abilityEffectText, abilityName } from '@bombfarm/domain/game-labels';
import { AbilityCard, Button, Panel, RankControl } from '@bombfarm/ui';
import {
  abilEffectClass,
  abilGridClass,
  abilHeadClass,
  abilMetaClass,
  abilNameClass,
  abilTagClass,
} from '@bombfarm/ui/ability-card.recipe';
import { AbilityIcon } from '@/shared/game-art';
import { cn } from '@bombfarm/ui';
import {
  colClass,
  mutedClass,
  panelHClass,
  panelTitleClass,
  tipClass,
  warnClass,
} from '@bombfarm/ui/panel-field.recipe';

export function HeroAbilitiesTab() {
  const { t, lang } = useAppLang();
  const { setAbilityLevel, resetAbilities } = useHeroBuildActions();

  const abilities = usePlannerStore((state) => state.abilities);
  const rarity = usePlannerStore((state) => state.rarity);
  const level = usePlannerStore((state) => state.level);

  const abilityPointsSpent = Object.values(abilities).reduce((sum, points) => sum + (points || 0), 0);
  const abilitySlotsMax = ABILITY_QUOTA[rarity];
  const abilityPointsMax = abilityPointBudget(rarity, level);
  // AC-38/AD-BSP-23a: granted (hero level) vs spendable (slot-capped budget) — Bram is the
  // worked case (L49 -> 40 spendable, 9 dead).
  const abilityPointsDead = Math.max(0, level - abilityPointsMax);
  const abilitySlotsUsed = heroAbilitySlotsUsed(abilities);
  const abilitySlotsFull = false;
  const abilitiesOrdered = abilitiesForHeroOrdered(abilities);

  const onResetAbilities = resetAbilities;
  const onAbilityLevel = setAbilityLevel;

  return (
    <main className={colClass}>
      <Panel>
        <div className={panelHClass}>
          <h2 className={panelTitleClass}>{t.panelAbilities}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className={abilitySlotsUsed > abilitySlotsMax ? warnClass : mutedClass}>
              {sub(t.abilitiesSlots, { used: abilitySlotsUsed, max: abilitySlotsMax })}
            </span>
            <span className={abilityPointsSpent > abilityPointsMax ? warnClass : mutedClass}>
              {sub(t.abilitiesSpent, { spent: abilityPointsSpent, max: abilityPointsMax })}
            </span>
            <span className={mutedClass}>
              {sub(t.abilitiesGrantedSpendable, { granted: level, spendable: abilityPointsMax })}
            </span>
            {/* DEC-03: always mounted — toggles invisible + aria-hidden, never mount/unmount. */}
            <span
              className={cn(warnClass, abilityPointsDead <= 0 && 'invisible')}
              aria-hidden={abilityPointsDead <= 0}
            >
              {sub(t.abilitiesDeadPoints, { dead: abilityPointsDead })}
            </span>
            <Button type="button" onClick={onResetAbilities}>
              {t.reset}
            </Button>
          </div>
        </div>
        <p className={tipClass}>{t.abilitiesTip}</p>
        <div className={abilGridClass}>
          {abilitiesOrdered.map((ability) => {
            const level = abilities[ability.id] ?? 0;
            const selected = level > 0;
            const lockedOut = !selected && abilitySlotsFull;
            const canInc =
              level < ability.max &&
              abilityPointsSpent < abilityPointsMax &&
              (selected || !abilitySlotsFull);
            const onSheet = isSheetAbility(ability);
            const aName = abilityName(ability.id, lang);
            const aFx = abilityEffectText(ability.id, lang);
            return (
              <AbilityCard selected={selected} onSheet={onSheet} lockedOut={lockedOut} key={ability.id}>
                <div className={abilHeadClass}>
                  <AbilityIcon code={ability.id} size="lg" className="shrink-0 self-start" />
                  <div className={abilMetaClass}>
                    <span className={abilNameClass} title={aFx}>
                      {aName}
                      {onSheet && <em className={abilTagClass}>{t.sheetAbilityTag}</em>}
                    </span>
                    <span className={abilEffectClass} title={aFx}>
                      {aFx}
                    </span>
                  </div>
                </div>
                <RankControl
                  className="mt-auto"
                  value={level}
                  max={ability.max}
                  label={aName}
                  lvLabel={t.rankLv}
                  disabledDec={level <= 0}
                  disabledInc={!canInc}
                  onChange={(next) => onAbilityLevel(ability.id, next)}
                />
              </AbilityCard>
            );
          })}
        </div>
      </Panel>
    </main>
  );
}
