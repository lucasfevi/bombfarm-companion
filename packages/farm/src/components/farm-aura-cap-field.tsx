'use client';

import { InfoTip, Tooltip } from '@bombfarm/ui';
import type { AurasAtCap, TeamAuraId } from '@bombfarm/domain/team-buffs';
import { AuraCapChips } from '@bombfarm/hero/components';
import type { Lang } from '@bombfarm/hero/copy';
import {
  farmFieldClass,
  farmFieldControlClass,
  farmFieldLabelClass,
} from './farm-ranking-filters';

type Props = {
  label: string;
  /** The sentence behind the label's info glyph — what the board prices with a chip lit. */
  hint: string;
  value: AurasAtCap;
  onToggle: (auraId: TeamAuraId, atCap: boolean) => void;
  lang: Lang;
  testId?: string;
};

/**
 * The team-aura chips as one field of the board's control row, on the same grid as the Return
 * Bonus beside them, with the label strings supplied by the host: a control only one host offers
 * keeps its copy in that host's own dictionary rather than in the one every host prints. The
 * chips themselves carry their own names and caps. The glyph is the Optimizer's setup-bar one,
 * under its own provider since the control row has none above it; the chips share it.
 */
export function FarmAuraCapField({ label, hint, value, onToggle, lang, testId }: Props) {
  return (
    <Tooltip.Provider delay={180} closeDelay={80}>
      <div className={farmFieldClass} data-testid={testId}>
        <span className={farmFieldLabelClass}>
          {label}
          <InfoTip label={label} tip={hint} />
        </span>
        <div className={farmFieldControlClass}>
          <AuraCapChips value={value} onToggle={onToggle} lang={lang} />
        </div>
      </div>
    </Tooltip.Provider>
  );
}
