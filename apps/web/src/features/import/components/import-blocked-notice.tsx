'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { cn } from '@bombfarm/ui';
import { importResetWarningClass } from '@bombfarm/ui/panel-field.recipe';

/**
 * Why a blocked hero needs prose and not just a dimmed row: dimming states that something is
 * different without saying what, which reads as a rendering glitch. The player cannot act on it
 * and cannot tell whether their account is damaged.
 *
 * Every route to `blocked` — gear the shipped catalog does not know, a missing `stats` block, a
 * sheet that inverts above the hero's point budget — collapses to the same two causes from where
 * the player stands: their save is older than the game, or the planner is. Both are named, each
 * with the action that resolves it, because only the player can tell the two apart (by exporting
 * a fresh save and trying again).
 */
export function ImportBlockedNotice({
  candidates,
  t,
}: {
  candidates: ImportCandidate[];
  t: Strings;
}) {
  const blocked = candidates.filter((candidate) => candidate.blocked);
  if (blocked.length === 0) return null;

  return (
    // `importResetWarningClass` ends in `mb-0`; `cn` resolves the conflict last-wins, so the
    // notice does not sit flush against the candidate table below it.
    <div className={cn(importResetWarningClass, 'mb-3')} role="status" data-testid="import-blocked-notice">
      <h2>{sub(t.importBlockedTitle, { count: blocked.length })}</h2>
      {/* The names sit directly under the title, not beside the "everything else is fine" line,
          where they read as examples of what DID import. */}
      <p className="font-semibold text-warn">
        {blocked.map((candidate) => candidate.name).join(', ')}
      </p>
      <p className="mt-1.5">{t.importBlockedBody}</p>
      <ul className="mt-1.5">
        <li>{t.importBlockedOldSave}</li>
        <li>{t.importBlockedAppBehind}</li>
      </ul>
      <p className="mt-1.5">{t.importBlockedRest}</p>
    </div>
  );
}
