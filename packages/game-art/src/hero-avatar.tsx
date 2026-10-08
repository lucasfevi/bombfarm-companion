import { heroAvatarSrc, normalizeSkin } from '@bombfarm/domain/wiki-assets';

import { ArtFrame, type ArtFrameSize } from './art-frame';
import { HeroDataFlagDot, useHeroDataFlag } from './hero-data-flag';
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
  /** The game's id for this hero. Given one, a hero the host holds back from calculations wears a
   *  flag on the portrait's corner saying why. */
  heroId?: string | undefined;
};

export function HeroAvatar({ skin, rarityIdx, size = 'lg', name, className, peek, heroId }: Props) {
  const flag = useHeroDataFlag(heroId);
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
  const peeked = usePeek(peek === undefined ? undefined : heroPeekSpec(peek), art);
  if (flag === undefined) return peeked;
  return (
    <span className="relative inline-flex shrink-0">
      {peeked}
      <HeroDataFlagDot flag={flag} />
    </span>
  );
}
