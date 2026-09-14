import { describe, expect, it } from 'vitest';
import { createTabScrollMemory } from './tab-scroll-memory';

describe('tab scroll memory', () => {
  it('a tab never left reads as the top', () => {
    expect(createTabScrollMemory().enter('optimizer')).toBe(0);
  });

  it('returns the offset a tab was left at', () => {
    const memory = createTabScrollMemory();
    memory.leave('optimizer', 1440);
    memory.leave('forge', 80);
    expect(memory.enter('optimizer')).toBe(1440);
    expect(memory.enter('forge')).toBe(80);
  });

  it('a later leave replaces the earlier offset', () => {
    const memory = createTabScrollMemory();
    memory.leave('optimizer', 1440);
    memory.leave('optimizer', 300);
    expect(memory.enter('optimizer')).toBe(300);
  });
});
