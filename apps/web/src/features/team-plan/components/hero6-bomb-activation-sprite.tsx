'use client';

import { SpriteLoop } from '@bombfarm/game-art';
import {
  HERO6_BOMB_ACTIVATION_FRAME_MS,
  HERO6_BOMB_ACTIVATION_FRAMES,
} from '@/features/team-plan/model/hero6-bomb-activation';

/** Pixel-art sprite loop for the optimizing modal — static when reduced-motion is on. */
export function Hero6BombActivationSprite({ className }: { className?: string }) {
  return (
    <SpriteLoop
      frames={HERO6_BOMB_ACTIVATION_FRAMES}
      frameDurationMs={HERO6_BOMB_ACTIVATION_FRAME_MS}
      width={192}
      height={192}
      className={className}
    />
  );
}
