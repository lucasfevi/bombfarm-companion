'use client';

import { useEffect, useState } from 'react';
import {
  HERO6_BOMB_ACTIVATION_FRAME_MS,
  HERO6_BOMB_ACTIVATION_FRAMES,
} from '@/features/gear-plan/model/hero6-bomb-activation';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Pixel-art sprite loop for the optimizing modal — static when reduced-motion is on. */
export function Hero6BombActivationSprite({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    for (const src of HERO6_BOMB_ACTIVATION_FRAMES) {
      const image = new window.Image();
      image.src = src;
    }
  }, []);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setFrame((prev) => (prev + 1) % HERO6_BOMB_ACTIVATION_FRAMES.length);
    }, HERO6_BOMB_ACTIVATION_FRAME_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  const src = HERO6_BOMB_ACTIVATION_FRAMES[reduced ? 0 : frame] ?? HERO6_BOMB_ACTIVATION_FRAMES[0];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local public PNG sprite sheet frames
    <img
      src={src}
      alt=""
      width={192}
      height={192}
      draggable={false}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
