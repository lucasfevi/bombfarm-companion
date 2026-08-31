'use client';

import type { Lang } from '@/shared/i18n';
import { LOOP_SECONDS, replicaFrameAt } from '../../model/live-replica-data';
import { useLoopClock } from '../../model/use-loop-clock';
import { EarningsCard } from './earnings-card';
import { HeroesCard } from './heroes-card';
import { MapCard } from './map-card';
import { ReplicaChrome } from './replica-chrome';

/**
 * A drawing of the desktop app's Live screen, playing back a 15-second loop.
 *
 * It shares no code with the real screen — the web app cannot reach into `apps/desktop`, by
 * boundary rule — so this is a second implementation of a layout that already exists, and the only
 * thing keeping the two together is discipline. Read `apps/web/AGENTS.md` before changing either
 * side: the panel order, the earnings/map row and the hero-row column shape all mirror the
 * desktop's own Live panel, and `MIRRORED` in `../../model/live-replica-copy.ts` mirrors that
 * shell's labels under guard.
 *
 * Every width here is fluid. The desktop's own Live screen is laid out at fixed widths because its
 * window will not go below 960px; a page anyone can open on a phone cannot borrow that, and a
 * drawing you have to scroll sideways to read is worse than one that reflows.
 *
 * Hidden from assistive technology on purpose: it is an illustration carrying sample numbers, and
 * every fact it shows is stated as text in the section that follows it.
 */
export function LiveReplica({ lang }: { lang: Lang }) {
  const elapsed = useLoopClock(LOOP_SECONDS);
  const frame = replicaFrameAt(elapsed);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-line bg-bg-2 shadow-[0_40px_90px_-44px_rgba(0,0,0,1)]">
      <div aria-hidden="true">
        <ReplicaChrome lang={lang} />
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <EarningsCard lang={lang} earnings={frame.earnings} />
            <MapCard lang={lang} map={frame.map} />
          </div>
          <HeroesCard lang={lang} summary={frame.summary} heroes={frame.heroes} />
        </div>
      </div>
    </div>
  );
}
