'use client';

import { HeroAvatar } from './hero-avatar';
import type { ArtFrameSize } from './art-frame';

/** A skin has no rarity, so its frame takes the grey the lowest tier draws rather than a tint. */
const SKIN_FRAME_RARITY_IDX = 0;

/** Avatar + name for a skin on its own, dressed on nobody — the art a hero wearing it would show. */
export function SkinIdentity({
  skin,
  name,
  size = 'xs',
  nameTestId,
}: {
  skin: number;
  name: string;
  size?: ArtFrameSize;
  /** `data-testid` on the element carrying the skin's name, for a caller that needs one. */
  nameTestId?: string | undefined;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="shrink-0">
        <HeroAvatar skin={skin} rarityIdx={SKIN_FRAME_RARITY_IDX} size={size} name={name} />
      </div>
      <span data-testid={nameTestId} className="truncate text-[11px] leading-none text-ink">
        {name}
      </span>
    </div>
  );
}
