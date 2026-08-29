'use client';

import { useEffect, useState } from 'react';

export interface SpriteLoopProps {
  /** Ordered frame image sources, shown in a loop. */
  frames: readonly string[];
  /** How long each frame stays on screen, in ms. */
  frameDurationMs: number;
  className?: string;
  width?: number;
  height?: number;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Preloading, reduced-motion-aware pixel-art frame loop — static on the first frame when
 *  reduce is set, looping otherwise. Shared by every sprite animation in the app. */
export function SpriteLoop({ frames, frameDurationMs, className, width, height }: SpriteLoopProps) {
  const [frame, setFrame] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    for (const frameSrc of frames) {
      const image = new window.Image();
      image['src'] = frameSrc;
    }
  }, [frames]);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const intervalId = window.setInterval(() => {
      setFrame((current) => (current + 1) % frames.length);
    }, frameDurationMs);
    return () => window.clearInterval(intervalId);
  }, [reduced, frames, frameDurationMs]);

  const frameSrc = frames[reduced ? 0 : frame] ?? frames[0];

  return (
    <img
      src={frameSrc}
      alt=""
      width={width}
      height={height}
      draggable={false}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
