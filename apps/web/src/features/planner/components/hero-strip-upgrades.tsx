'use client';

import {
  canLevelUp,
  canStarUp,
  nextLevelStep,
  nextStarsStep,
} from '@bombfarm/domain/gear';
import { useAppLang } from '@/shared/context/app-lang';
import { Button, Num, Select, cn } from '@bombfarm/ui';
import { usePlannerStore, selectHeroLevel, selectHeroStars } from '@/shared/stores';
import { useHeroDraftActions } from '../hooks/use-hero-draft-actions';
import { UpgradeField } from './hero-strip-upgrade-field';

const railDividerClass = 'border-line';

export function HeroStripUpgrades() {
  const { t } = useAppLang();
  const { changeLevel, changeStars } = useHeroDraftActions();
  const level = usePlannerStore(selectHeroLevel);
  const stars = usePlannerStore(selectHeroStars);
  const onLevelChange = changeLevel;
  const onStarsChange = changeStars;

  return (
    <div
      className={cn(
        'flex items-end gap-2.5 border-b px-2.5 py-1.5 xl:border-r xl:border-b-0',
        railDividerClass,
      )}
    >
      <UpgradeField label={t.level}>
        <Num className="w-full" value={level} onChange={onLevelChange} step={1} />
        <Button
          type="button"
          className="h-full whitespace-nowrap px-2 text-xs"
          disabled={!canLevelUp(level)}
          onClick={() => onLevelChange(nextLevelStep(level))}
        >
          {t.levelUp}
        </Button>
      </UpgradeField>
      <UpgradeField label={t.stars}>
        <Select className="w-full" value={stars} onChange={(event) => onStarsChange(Number(event.target.value))}>
          {[0, 1, 2, 3].map((starOption) => (
            <option key={starOption} value={starOption}>
              {starOption === 0 ? '—' : '★'.repeat(starOption)}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          className="h-full whitespace-nowrap px-2 text-xs"
          disabled={!canStarUp(stars)}
          onClick={() => onStarsChange(nextStarsStep(stars))}
        >
          {t.starUpgrade}
        </Button>
      </UpgradeField>
    </div>
  );
}
