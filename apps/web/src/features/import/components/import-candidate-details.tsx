'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import { statLabel } from '@bombfarm/domain/game-labels';
import { formatNumber } from '@/shared/lib/format-number';
import type { Lang, Strings } from '@/shared/i18n';
import { DataTable } from '@bombfarm/ui';
import { STAT_KEYS, pointIssueCopyText } from '../model/compare-candidates';

export function ImportCandidateDetails({
  candidate,
  t,
  lang,
}: {
  candidate: ImportCandidate;
  t: Strings;
  lang: Lang;
}) {
  const pointIssueText = pointIssueCopyText(t, candidate.pointIssues);

  return (
    <DataTable.Row>
      {/* 6 columns since T13 dropped the checkbox column (was 7). */}
      <DataTable.Cell colSpan={6} className="bg-bg" nowrap={false}>
        <div className="grid grid-cols-2 gap-3 px-1 py-1.5 [&_p]:mt-1 [&_ul]:mt-1 [&_ul]:pl-4">
          <div>
            <b>{t.importStats}</b>
            <ul>
              {STAT_KEYS.map((key) => (
                <li key={key}>
                  {statLabel(key, lang)}: {formatNumber(candidate.record.gearedOverride[key], 2)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <b>
              {t.importAbilities} ({candidate.abilityCount})
            </b>
            <p>
              {t.importGearSlots}: {candidate.gearCount}
            </p>
            {/* BSP-04b/AC-35: the cap-saturation copy branch, ahead of the plain issue list. */}
            {pointIssueText ? <p className="text-warn">{pointIssueText}</p> : null}
            {candidate.issues.length > 0 && (
              <ul className="text-warn">
                {candidate.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DataTable.Cell>
    </DataTable.Row>
  );
}
