import type { RawGameState } from '@bombfarm/contracts';
import { isRecord, parseNumericField } from '../validation.js';

export interface StateParseResult {
  ok: true;
  state: RawGameState;
  gold: number;
}

export interface StateParseFailure {
  ok: false;
  reason: string;
}

export type StateParseOutput = StateParseResult | StateParseFailure;

export function classifyGameState(value: unknown): value is RawGameState {
  if (!isRecord(value)) return false;
  if (value.t !== 'snap') return false;
  const gold = parseNumericField(value.gold);
  if (gold == null || gold < 0) return false;
  if (!Array.isArray(value.kinds) || !Array.isArray(value.hps)) return false;
  return true;
}

export function parseGameState(value: unknown): StateParseOutput {
  if (!classifyGameState(value)) {
    return { ok: false, reason: 'not_a_game_state' };
  }

  const state = value;
  const gold = parseNumericField(state.gold);
  if (gold == null) {
    return { ok: false, reason: 'invalid_gold' };
  }

  return { ok: true, state, gold };
}

export function extractJsonObjects(buffer: string): unknown[] {
  const results: unknown[] = [];
  let start = buffer.indexOf('{');
  while (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let i = start; i < buffer.length; i++) {
      const ch = buffer[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
        if (depth < 0) break;
      }
    }
    if (end === -1) break;
    const slice = buffer.slice(start, end);
    try {
      results.push(JSON.parse(slice));
    } catch {
      // skip malformed
    }
    start = buffer.indexOf('{', end);
  }
  return results;
}
