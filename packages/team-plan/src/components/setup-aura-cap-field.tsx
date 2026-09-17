'use client';

import type { AurasAtCap, TeamAuraId } from '@bombfarm/domain/team-buffs';
import { AuraCapChips } from '@bombfarm/hero/components';
import type { Lang } from '@bombfarm/hero/copy';
import { SetupField } from './setup-field';

/**
 * The team-aura chips as one field of the setup bar, with the label strings supplied by the host
 * — a control only one host offers keeps its copy in that host's own dictionary rather than in
 * the one every host prints. The chips carry their own names and caps. Same grid and height as
 * `IgnoreCrowdingField`; the toolbar's provider serves the chips' tooltips.
 */
export function SetupAuraCapField({
  label,
  hint,
  value,
  onToggle,
  lang,
  testId,
}: {
  label: string;
  /** What the next run answers with a chip lit. */
  hint: string;
  value: AurasAtCap;
  onToggle: (auraId: TeamAuraId, atCap: boolean) => void;
  lang: Lang;
  testId?: string;
}) {
  return (
    <SetupField label={label} hint={hint} className="min-w-52 flex-1" {...(testId === undefined ? {} : { testId })}>
      <span className="flex h-[34px] items-center">
        <AuraCapChips value={value} onToggle={onToggle} lang={lang} />
      </span>
    </SetupField>
  );
}
