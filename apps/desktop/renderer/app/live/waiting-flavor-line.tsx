'use client';

import { useEffect, useState } from 'react';
import type { Copy } from '../../lib/copy';

export const WAITING_FLAVOR_LINE_KEYS = [
  'liveNeverReadFlavorLine1',
  'liveNeverReadFlavorLine2',
  'liveNeverReadFlavorLine3',
  'liveNeverReadFlavorLine4',
  'liveNeverReadFlavorLine5',
] as const satisfies readonly (keyof Copy)[];

const ROTATE_MS = 4000;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Rotates slowly through a short set of lines so a long wait does not sit on one frozen sentence
 *  — held on the first line, never rotating, under `prefers-reduced-motion`. Mirrors
 *  `SpriteLoop`'s own reduced-motion handling rather than sharing it, since that hook lives
 *  unexported in a different package. */
export function WaitingFlavorLine({ lines }: { lines: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setReduced(media.matches);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % lines.length);
    }, ROTATE_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [reduced, lines]);

  const line = lines[reduced ? 0 : index] ?? lines[0];

  return <p className="m-0 mt-1 text-xs text-muted">{line}</p>;
}
