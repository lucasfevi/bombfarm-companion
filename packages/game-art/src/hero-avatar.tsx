import { heroAvatarSrc, normalizeSkin } from '@bombfarm/domain/wiki-assets';

import { ArtFrame, type ArtFrameSize } from './art-frame';

type Props = {
  skin: number;
  rarityIdx: number;
  size?: ArtFrameSize;
  name: string;
  className?: string | undefined;
};

export function HeroAvatar({ skin, rarityIdx, size = 'lg', name, className }: Props) {
  return (
    <ArtFrame rarityIdx={rarityIdx} size={size} className={className}>
      <img
        src={heroAvatarSrc(normalizeSkin(skin))}
        alt={name}
        className="size-full object-cover object-top"
        draggable={false}
      />
    </ArtFrame>
  );
}
