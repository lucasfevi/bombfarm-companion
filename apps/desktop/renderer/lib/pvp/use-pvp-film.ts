'use client';

import { useEffect, useState } from 'react';
import type { PvpFilmView } from '@bombfarm/contracts';

type Bridge = NonNullable<Window['bfc']>;

export type PvpFilmStatus = 'idle' | 'loading' | 'ready' | 'missing';

export interface PvpFilmState {
  readonly status: PvpFilmStatus;
  readonly view: PvpFilmView | null;
}

const IDLE: PvpFilmState = { status: 'idle', view: null };
const LOADING: PvpFilmState = { status: 'loading', view: null };
const MISSING: PvpFilmState = { status: 'missing', view: null };

function bridgeOf(): Bridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { bfc?: Bridge }).bfc ?? null;
}

/** The only `pvp:film` call site. Fetched on demand for the film the player opened and dropped
 *  when they close it or open another — the body stays in main; what crosses is the summary. */
export function usePvpFilm(filmId: number | null): PvpFilmState {
  const [state, setState] = useState<PvpFilmState>(IDLE);

  useEffect(() => {
    if (filmId === null) {
      setState(IDLE);
      return;
    }
    const bridge = bridgeOf();
    if (!bridge) {
      setState(MISSING);
      return;
    }
    let current = true;
    setState(LOADING);
    bridge
      .invoke('pvp:film', filmId)
      .then((view) => {
        if (current) setState(view === null ? MISSING : { status: 'ready', view });
      })
      .catch(() => {
        if (current) setState(MISSING);
      });
    return () => {
      current = false;
    };
  }, [filmId]);

  return state;
}
