'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import { raritySortIdx } from '@bombfarm/domain/roster-sort';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { formatNumber } from '@/shared/lib/format-number';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { Button, Chip, DataTable } from '@bombfarm/ui';
import { HeroAvatar, rarityTextClass } from '@/shared/game-art';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { ImportCandidateDetails } from './import-candidate-details';

export function ImportCandidateRow({
  candidate,
  expanded,
  t,
  lang,
  onToggleExpand,
}: {
  candidate: ImportCandidate;
  expanded: boolean;
  t: Strings;
  lang: Lang;
  onToggleExpand: (sourceId: string) => void;
}) {
  const rar = raritySortIdx(candidate.rarity);
  const rarIdx = RARITIES.indexOf(candidate.rarity);

  return (
    <>
      <DataTable.Row>
        <DataTable.Cell className="w-11 px-1" nowrap={false}>
          <HeroAvatar skin={candidate.record.skin ?? 0} rarityIdx={rarIdx} size="sm" name={candidate.name} />
        </DataTable.Cell>
        <DataTable.Cell>{candidate.level}</DataTable.Cell>
        <DataTable.Cell nowrap={false}>
          <Button type="button" variant="text" onClick={() => onToggleExpand(candidate.sourceId)}>
            {candidate.name}
          </Button>
          {candidate.matchedExistingId && (
            <Chip variant="small">
              {candidate.isGearRefresh ? t.importGearRefreshBadge : t.importUpdateBadge}
            </Chip>
          )}
          {candidate.issues.length > 0 && (
            <Chip variant="small-warn">
              {sub(t.importIssuesCount, { count: candidate.issues.length })}
            </Chip>
          )}
        </DataTable.Cell>
        <DataTable.Cell>
          <span className={rarityTextClass(rar)}>{rarityLabel(candidate.rarity, lang)}</span>
        </DataTable.Cell>
        <DataTable.Cell>{candidate.rank ?? '—'}</DataTable.Cell>
        <DataTable.Cell align="right" numeric>
          {formatNumber(candidate.power, 0)}
        </DataTable.Cell>
      </DataTable.Row>
      {expanded ? <ImportCandidateDetails candidate={candidate} t={t} lang={lang} /> : null}
    </>
  );
}
