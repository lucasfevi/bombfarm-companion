'use client';

import { useState } from 'react';
import { Icon } from '@bombfarm/ui';
import type { Lang, Strings } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import { LOOP_SECONDS, replicaFrameAt } from '../../model/live-replica-data';
import { DEFAULT_MINI_LAYOUT, type MiniLiveLayout } from '../../model/mini-live-layout';
import { useLoopClock } from '../../model/use-loop-clock';
import { MiniLayoutControls } from './mini-layout-controls';
import { MiniWindowFrame } from './mini-window-frame';

/**
 * The window is drawn on the same clock as the full-size replica above it, so the two agree
 * second for second rather than telling a reader two different stories about one session.
 *
 * The controls sit beside the drawing on a wide screen and above it on a narrow one, never below.
 * The frame grows and shrinks as panels are switched, and that growth has to run away from the
 * control the reader is holding — reserving the tallest arrangement instead would hold the page
 * still at the cost of a screen of blank space under the drawing in every other arrangement.
 */
export function MiniWindowSection({ t, lang }: { t: Strings; lang: Lang }) {
  const [layout, setLayout] = useState<MiniLiveLayout>(DEFAULT_MINI_LAYOUT);
  const elapsed = useLoopClock(LOOP_SECONDS);
  const frame = replicaFrameAt(elapsed);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="m-0 font-mono text-[10.5px] tracking-[0.17em] text-muted uppercase">
          {t.downloadMiniHeading}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 font-mono text-[10px] text-muted">
          <Icon name="window" size="sm" />
          {liveLabel('miniLiveOpenLabel', lang)}
        </span>
        <span className="h-px flex-1 bg-line/60" />
      </div>
      <p className="m-0 mb-6 max-w-[62ch] text-[15px] leading-relaxed text-muted">
        {t.downloadMiniLede}
      </p>

      <div className="flex flex-col-reverse items-start gap-5 md:flex-row">
        <div className="w-full min-w-0 overflow-x-auto pb-2 md:w-auto md:shrink-0">
          <MiniWindowFrame lang={lang} layout={layout} frame={frame} />
        </div>
        <MiniLayoutControls t={t} lang={lang} layout={layout} onLayoutChange={setLayout} />
      </div>
    </section>
  );
}
