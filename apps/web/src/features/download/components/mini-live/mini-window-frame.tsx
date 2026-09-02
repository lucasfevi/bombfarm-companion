import type { Lang } from '@/shared/i18n';
import type { ReplicaFrame } from '../../model/live-replica-data';
import type { MiniLiveLayout } from '../../model/mini-live-layout';
import { EarningsCard } from '../live/earnings-card';
import { HeroesCard } from '../live/heroes-card';
import { MapCard } from '../live/map-card';
import { MiniWindowChrome } from './mini-window-chrome';

/**
 * The compact Live window, drawn from the same frame as the full-size replica and reshaped by the
 * layout the reader picks. Stacked grows downward, side by side grows across — the two directions
 * the real window offers.
 *
 * Hidden from assistive technology for the reason the full-size replica is: it is an illustration
 * carrying sample numbers, every fact in it is stated as text elsewhere on the page, and the
 * controls beside it announce their own state, which is the part a reader acts on.
 */
export function MiniWindowFrame({
  lang,
  layout,
  frame,
}: {
  lang: Lang;
  layout: MiniLiveLayout;
  frame: ReplicaFrame;
}) {
  return (
    <div
      aria-hidden="true"
      data-axis={layout.axis}
      data-testid="download-mini-window"
      className="w-max overflow-hidden rounded-xl border border-line bg-bg-2 shadow-[0_40px_90px_-44px_rgba(0,0,0,1)]"
    >
      <MiniWindowChrome />
      <div
        className={
          layout.axis === 'horizontal'
            ? 'flex flex-row items-start gap-2 p-2'
            : 'flex flex-col gap-2 p-2'
        }
      >
        {layout.showEarnings ? (
          <EarningsCard
            density="compact"
            lang={lang}
            earnings={frame.earnings}
            measured={frame.measured}
          />
        ) : null}
        {layout.showMap ? <MapCard density="compact" lang={lang} map={frame.map} /> : null}
        {layout.showHeroes ? (
          <HeroesCard
            density="compact"
            lang={lang}
            summary={frame.summary}
            heroes={frame.heroes}
          />
        ) : null}
      </div>
    </div>
  );
}
