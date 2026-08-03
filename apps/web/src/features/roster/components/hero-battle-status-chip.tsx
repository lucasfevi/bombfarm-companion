'use client';

import type { Strings } from '@/shared/i18n';
import { Chip } from '@bombfarm/ui';

type Props = {
  battleAllowed: boolean;
  t: Strings;
  className?: string;
};

/** Save `battle_allowed` — whether the game lists this hero as battle-eligible. */
export function HeroBattleStatusChip({ battleAllowed, t, className }: Props) {
  return (
    <Chip
      variant={battleAllowed ? 'small-active' : 'small-warn'}
      className={className}
      title={battleAllowed ? t.heroBattleActiveTitle : t.heroBattleInactiveTitle}
    >
      {battleAllowed ? t.heroBattleActive : t.heroBattleInactive}
    </Chip>
  );
}
