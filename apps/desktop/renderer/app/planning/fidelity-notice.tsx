/**
 * The provenance display (design.md §5, §7.2). Names every section in
 * `AccountFidelityReport.degradedSections`, in the report's own order (MPV-07), and for a
 * `degraded` section, its `missingKeys` in a diagnosable form distinct from `missing` (MPV-08,
 * latent per `AD-037` — implemented and unit-tested; unreachable end to end today).
 *
 * WHEN the derived grade is `full` THEN this renders nothing at all (MPV-06) — the always-mounted
 * slot lives one level up in `planning-view.tsx`, which only mounts this component when
 * `degradedSections` is non-empty, so there is no empty Banner shell to reserve space for.
 */
import { Banner, Chip, HelpTip } from '@bombfarm/ui';
import { ACCOUNT_SECTION_COPY_KEY, SECTION_STATUS_COPY_KEY, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import type { PlanningModel } from '../../lib/planning/types';

export function FidelityNotice({ model }: { model: PlanningModel }) {
  const t = useCopy();
  if (model.report.degradedSections.length === 0) return null;

  const degraded = model.report.degradedSections
    .map((section) => model.sections.find((entry) => entry.section === section))
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  return (
    <Banner tone="warn" title={t.fidelityNoticeTitle} data-testid="fidelity-notice">
      <ul className="m-0 flex flex-col gap-1 list-none p-0 text-sm">
        {degraded.map((section) => (
          <li key={section.section} data-testid={`fidelity-section-${section.section}`} className="flex items-center gap-2">
            <span>{t[ACCOUNT_SECTION_COPY_KEY[section.section]]}</span>
            <Chip variant="small-warn">{t[SECTION_STATUS_COPY_KEY[section.status]]}</Chip>
            {section.capturedAt ? <span className="text-xs text-muted">{formatCapturedAt(section.capturedAt, t)}</span> : null}
            {section.status === 'degraded' && section.missingKeys.length > 0 ? (
              <span data-testid="fidelity-missing-keys" className="flex items-center gap-1 text-xs text-muted">
                <code>{section.missingKeys.join(', ')}</code>
                <HelpTip label={t.fidelityMissingKeysLabel}>{t.fidelityMissingKeysLabel}</HelpTip>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Banner>
  );
}
