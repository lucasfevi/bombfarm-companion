// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PvpFilmView } from '@bombfarm/contracts';
import { usePvpFilm, type PvpFilmState } from './use-pvp-film';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEW: PvpFilmView = {
  filmId: 48117,
  series: [{ second: 0, attackerDamage: 0, defenderDamage: 0, roomHp: 1 }],
  facts: {
    leadTakenAtSecond: null,
    widestLead: null,
    roomHpLeft: 1,
    bombs: { attacker: 0, defender: 0 },
    heroes: { attacker: 5, defender: 5 },
    frames: 1,
    hz: 12,
    seconds: 60,
  },
};

type Deferred = { resolve: (view: PvpFilmView | null) => void; reject: (reason: unknown) => void };

describe('usePvpFilm', () => {
  let container: HTMLDivElement;
  let root: Root;
  let seen: PvpFilmState[];
  let pending: Map<number, Deferred>;
  let invoke: ReturnType<typeof vi.fn>;

  function Probe({ filmId }: { filmId: number | null }) {
    seen.push(usePvpFilm(filmId));
    return null;
  }

  function render(filmId: number | null) {
    act(() => {
      root.render(createElement(Probe, { filmId }));
    });
  }

  async function settle(filmId: number, view: PvpFilmView | null) {
    await act(async () => {
      pending.get(filmId)?.resolve(view);
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    seen = [];
    pending = new Map();
    invoke = vi.fn(
      (_channel: string, filmId: number) =>
        new Promise<PvpFilmView | null>((resolve, reject) => {
          pending.set(filmId, { resolve, reject });
        }),
    );
    (window as unknown as { bfc: unknown }).bfc = { invoke };
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (window as unknown as { bfc?: unknown }).bfc;
  });

  it('stays idle with no film open, and asks main for nothing', () => {
    render(null);
    expect(seen.at(-1)).toEqual({ status: 'idle', view: null });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('asks main for the film by id, reports loading until it answers, then ready with the view', async () => {
    render(48117);
    expect(invoke).toHaveBeenCalledWith('pvp:film', 48117);
    expect(seen.at(-1)?.status).toBe('loading');
    await settle(48117, VIEW);
    expect(seen.at(-1)).toEqual({ status: 'ready', view: VIEW });
  });

  it('reports missing when main holds no such film, and when the call fails', async () => {
    render(48117);
    await settle(48117, null);
    expect(seen.at(-1)).toEqual({ status: 'missing', view: null });

    render(48118);
    await act(async () => {
      pending.get(48118)?.reject(new Error('bridge down'));
      await Promise.resolve();
    });
    expect(seen.at(-1)).toEqual({ status: 'missing', view: null });
  });

  it('ignores a late answer for a film the player has already left', async () => {
    render(48117);
    render(48118);
    await settle(48117, VIEW);
    expect(seen.at(-1)?.status).toBe('loading');
    await settle(48118, { ...VIEW, filmId: 48118 });
    expect(seen.at(-1)?.view?.filmId).toBe(48118);
  });

  it('goes back to idle when the film is closed', async () => {
    render(48117);
    await settle(48117, VIEW);
    render(null);
    expect(seen.at(-1)).toEqual({ status: 'idle', view: null });
  });

  it('reports missing without a bridge', () => {
    delete (window as unknown as { bfc?: unknown }).bfc;
    render(48117);
    expect(seen.at(-1)).toEqual({ status: 'missing', view: null });
  });
});
