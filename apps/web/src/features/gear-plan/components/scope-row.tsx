'use client';

import { Button, cn } from '@bombfarm/ui';
import { HeroAvatar, rarityTextClass } from '@/shared/game-art';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@/shared/lib/storage';
import type { ScopeState } from '@/shared/stores/gear-plan/types';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';

const scopeOptions: { value: ScopeState; label: (strings: Strings) => string }[] = [
  { value: 'optimize', label: (strings) => strings.gearPlanScopeOptimize },
  { value: 'donate', label: (strings) => strings.gearPlanScopeDonate },
  { value: 'leaveAlone', label: (strings) => strings.gearPlanScopeLeaveAlone },
];

export function ScopeRow({
  hero,
  scope,
  t,
  onScope,
}: {
  hero: HeroRecord;
  scope: ScopeState;
  t: Strings;
  onScope: (scope: ScopeState) => void;
}) {
  const rarIdx = RARITIES.indexOf(hero.rarity);
  const label = sub(t.gearPlanHeroRowLabel, {
    name: hero.name,
    level: String(hero.level),
    id: shortHeroRecordId(hero),
  });
  const battleAllowed = hero.battleAllowed ?? true;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2" title={hero.sourceId ?? hero.id}>
        <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarIdx} size="md" name={hero.name} />
        <div className="min-w-0">
          <div className={cn('truncate text-sm font-semibold', rarityTextClass(rarIdx))}>{label}</div>
          {!battleAllowed ? (
            <div className="text-[11px] text-muted">{t.gearPlanScopeDonateHint}</div>
          ) : null}
        </div>
      </div>
      <div
        className="inline-flex flex-wrap gap-1"
        role="group"
        aria-label={label}
      >
        {scopeOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={scope === option.value ? 'primary' : 'default'}
            aria-pressed={scope === option.value}
            onClick={() => onScope(option.value)}
          >
            {option.label(t)}
          </Button>
        ))}
      </div>
    </div>
  );
}
