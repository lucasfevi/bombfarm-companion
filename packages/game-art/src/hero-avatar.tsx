import { heroAvatarSrc, normalizeSkin } from '@bombfarm/domain/wiki-assets';

import { ArtFrame, type ArtFrameSize } from './art-frame';
import { heroPeekSpec, type HeroAvatarPeek } from './peek/hero-peek';
import { usePeek } from './peek/use-peek';

type Props = {
  skin: number;
  rarityIdx: number;
  size?: ArtFrameSize;
  name: string;
  className?: string | undefined;
  /** Open the hero's card on hover. Absent, the avatar is bare art — the subject of its own
   *  screen, or one drawn inside a card. */
  peek?: HeroAvatarPeek | undefined;
};

export function HeroAvatar({ skin, rarityIdx, size = 'lg', name, className, peek }: Props) {
  const art = (
    <ArtFrame rarityIdx={rarityIdx} size={size} className={className}>
      <img
        src={heroAvatarSrc(normalizeSkin(skin))}
        alt={name}
        className="size-full object-cover object-top"
        draggable={false}
      />
    </ArtFrame>
  );
  return usePeek(peek === undefined ? undefined : heroPeekSpec(peek), art);
}
