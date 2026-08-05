'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import type { HeroRecord } from '@/shared/lib/storage';
import { sub, type Strings } from '@/shared/i18n';
import { summarizeImportSync } from '../model/compare-candidates';

/** `AC-32`/`BSP-49` — the review-before-confirm created/updated/removed breakdown, plus the
 *  `BSP-51`/`AC-34` removed-hero note (shown only when the sync actually removes something). */
export function ImportSyncSummary({
  candidates,
  existing,
  t,
}: {
  candidates: ImportCandidate[];
  existing: HeroRecord[];
  t: Strings;
}) {
  const { created, updated, removed } = summarizeImportSync(candidates, existing);
  return (
    <div className="mb-2 shrink-0 text-xs">
      <p className="m-0 text-muted">{sub(t.importSyncSummary, { created, updated, removed })}</p>
      {removed > 0 ? <p className="m-0 mt-1 text-warn">{t.importRemovedNote}</p> : null}
    </div>
  );
}
