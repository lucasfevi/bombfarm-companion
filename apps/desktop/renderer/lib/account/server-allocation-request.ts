import type { AccountView } from '@bombfarm/contracts';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { capturedAtOf } from './account-facts';

/**
 * The heroes whose spent points the import could not recover exactly from the sheet — a stat at
 * its cap hides points the sheet cannot show, and the shortfall reads the same on every sync.
 * Main reads the game's own allocation for exactly these; it never parses the roster itself.
 */
export function heroIdsWithInexactPoints(view: AccountView): string[] {
  const parsed = parseAccountPayload(view.payload, []);
  if (parsed.rejected !== null) return [];
  return parsed.candidates.filter((candidate) => candidate.pointIssues.length > 0).map((candidate) => candidate.sourceId);
}

/** Asks once per heroes read, so a push that did not re-read the roster asks nothing again. */
export function createServerAllocationRequester(request: (heroIds: readonly string[]) => void) {
  let lastAsked: string | null = null;
  return (view: AccountView): void => {
    const heroIds = heroIdsWithInexactPoints(view);
    if (heroIds.length === 0) return;
    const asked = JSON.stringify([capturedAtOf(view.payload, 'heroes'), heroIds]);
    if (asked === lastAsked) return;
    lastAsked = asked;
    request(heroIds);
  };
}
