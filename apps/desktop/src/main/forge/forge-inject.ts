import type { ForgeEvent } from '@bombfarm/contracts';

/**
 * The smoke hook: a scripted run pushed through the same `forge:event` seam the real service
 * emits on, with no transport, no gate and no ledger row. Honoured only where the fixture
 * account reader is — unpackaged, `BFC_GAME_READER=fixture` — so a shipped build cannot be made
 * to draw a run that never happened.
 */
export function shouldHonourForgeInject(env: NodeJS.ProcessEnv, isPackaged: boolean): boolean {
  return !isPackaged && env.BFC_GAME_READER === 'fixture';
}

export interface ForgeInjector {
  inject(events: unknown): { ok: boolean };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isForgeEvent(value: unknown): value is ForgeEvent {
  if (!isRecord(value) || typeof value.runId !== 'string') return false;
  if (value.type === 'step') return typeof value.itemId === 'string' && typeof value.to === 'number';
  if (value.type === 'done') return isRecord(value.result) && typeof value.result.stop === 'string';
  return false;
}

export function createForgeInjector(deps: { honoured: () => boolean; emit: (event: ForgeEvent) => void }): ForgeInjector {
  return {
    inject(events) {
      if (!deps.honoured()) return { ok: false };
      if (!Array.isArray(events) || !events.every(isForgeEvent)) return { ok: false };
      for (const event of events) deps.emit(event);
      return { ok: true };
    },
  };
}
