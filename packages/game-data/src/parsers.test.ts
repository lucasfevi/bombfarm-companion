import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyInventoryBag, parseInventoryBag } from './parsers/inventory.js';
import { classifyGameState, parseGameState } from './parsers/state.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8')) as unknown;
}

describe('INV-1 inventory parser', () => {
  it('accepts known bag shape with optional fields', () => {
    const bag = loadFixture('inventory-bag-v2.json');
    expect(classifyInventoryBag(bag)).toBe(true);
    const parsed = parseInventoryBag(bag);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.items.length).toBe(4);
    expect(parsed.bagTabs).toBe(4);
    expect(parsed.bagCapacity).toBe(100);
    expect(parsed.items[0]?.equippedOn).toBe('13788');
  });

  it('INV-2 rejects garbage format-string false positives', () => {
    const garbage = loadFixture('garbage-format-string.json');
    expect(classifyInventoryBag(garbage)).toBe(false);
    expect(parseInventoryBag(garbage).ok).toBe(false);
  });
});

describe('state parser', () => {
  it('accepts live snap objects', () => {
    const state = loadFixture('state-push-a.json');
    expect(classifyGameState(state)).toBe(true);
    const parsed = parseGameState(state);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.gold).toBe(41091);
  });
});
