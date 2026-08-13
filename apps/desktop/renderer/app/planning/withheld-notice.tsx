/**
 * The shared, always-mounted withheld-quantity notice (design.md §5, §7.2, `docs/no-layout-shift.md`
 * rule 1). Renders a `Banner`, never `—`, `0`, `NaN`, `null` or a spinner in place of a number.
 * Names the quantity, names the section(s) it depends on, and states each one's status in player
 * language.
 */
import { Banner } from '@bombfarm/ui';
import { ACCOUNT_SECTION_COPY_KEY, SECTION_STATUS_COPY_KEY, sub, useCopy, type CopyKey } from '../../lib/copy';
import type { AdviceQuantity, SectionUsability } from '../../lib/planning/types';

const QUANTITY_TITLE_KEY = {
  rosterRow: 'withheldRosterRowTitle',
  gearSummary: 'withheldGearSummaryTitle',
  dps: 'withheldDpsTitle',
  nextPointRanking: 'withheldNextPointRankingTitle',
  resetAdvice: 'withheldResetAdviceTitle',
} as const satisfies Record<AdviceQuantity, CopyKey>;

export function WithheldNotice({
  quantity,
  sections,
}: {
  quantity: AdviceQuantity;
  sections: readonly SectionUsability[];
}) {
  const t = useCopy();
  const unusable = sections.filter((section) => !section.usable);
  const sectionNames = unusable
    .map((section) => t[ACCOUNT_SECTION_COPY_KEY[section.section]])
    .join(', ');

  return (
    <Banner tone="warn" title={t[QUANTITY_TITLE_KEY[quantity]]} data-testid={`withheld-${quantity}`}>
      <p className="m-0">{sub(t.withheldBecause, { sections: sectionNames })}</p>
      <ul className="m-0 list-none p-0 text-xs">
        {unusable.map((section) => (
          <li key={section.section}>
            {t[ACCOUNT_SECTION_COPY_KEY[section.section]]} — {t[SECTION_STATUS_COPY_KEY[section.status]]}
          </li>
        ))}
      </ul>
    </Banner>
  );
}
