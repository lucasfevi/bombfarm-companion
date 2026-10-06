'use client';

import { Banner, Button } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import type { DeconstructOutcome } from '../../lib/deconstruct/deconstruct-run-reducer';
import { deconstructResultView, type DeconstructLabels } from './deconstruct-labels';

/**
 * What the last burn came to, over the foot of the batch's tile region. The slot is always in the
 * tree and holds nothing until a run settles; it is out of flow, so its opening moves nothing —
 * not the Burn button under it, not the panel around it. The band is a live region, so the answer
 * is read out without the player hunting for it.
 */
export function DeconstructResultBand({
  outcome,
  labels,
  onDone,
}: {
  outcome: DeconstructOutcome | null;
  labels: DeconstructLabels;
  onDone: () => void;
}) {
  const t = useCopy();
  const view = outcome === null ? null : deconstructResultView(outcome, t, labels);

  return (
    <div data-testid="deconstruct-result-slot" className="absolute inset-x-0 bottom-0 z-10 max-h-full overflow-y-auto rounded-md">
      {view === null || outcome === null ? null : (
        <Banner
          tone={view.tone}
          layout="embedded"
          title={view.heading}
          className="mb-0"
          data-testid="deconstruct-result"
          data-outcome={outcome.kind}
        >
          <div className="flex flex-col gap-2">
            {view.lines.map((line) => (
              <p key={line} className="m-0 text-xs leading-[1.45] text-ink">
                {line}
              </p>
            ))}
            <div className="flex justify-end">
              <Button type="button" variant="default" data-testid="deconstruct-done" onClick={onDone}>
                {t.forgeDone}
              </Button>
            </div>
          </div>
        </Banner>
      )}
    </div>
  );
}
