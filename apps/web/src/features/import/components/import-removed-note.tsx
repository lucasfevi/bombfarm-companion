'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import type { HeroRecord } from '@/shared/lib/storage';
import type { Strings } from '@/shared/i18n';
import { countRemovedHeroes } from '../model/compare-candidates';

/**
 * `BSP-51`/`AC-34` — the one thing about a sync the player cannot undo.
 *
 * This used to sit under a created/updated/removed breakdown. That breakdown was bookkeeping from
 * when an import was a merge the player curated; the save is the source of truth now, so the split
 * between created and updated is not a decision they make or a number they act on. A hero leaving
 * the roster still is, so it stays — and only when something is actually leaving.
 */
export function ImportRemovedNote({
  candidates,
  existing,
  t,
}: {
  candidates: ImportCandidate[];
  existing: HeroRecord[];
  t: Strings;
}) {
  const removed = countRemovedHeroes(candidates, existing);
  if (removed === 0) return null;
  return <p className="mb-2 shrink-0 text-xs text-warn">{t.importRemovedNote}</p>;
}
