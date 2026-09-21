import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TeamPlanScreenSlots } from './team-plan-screen';

describe('the applyPanel slot sits between the gain breakdown and the hero table', () => {
  const source = readFileSync(path.join(__dirname, 'team-plan-screen.tsx'), 'utf8');

  it('renders WaterfallPanel, then the bare slot expression, then HeroDeltaTable, in source order', () => {
    const waterfallAt = source.indexOf('<WaterfallPanel');
    const slotAt = source.indexOf('{slots.applyPanel ?? null}');
    const tableAt = source.indexOf('<HeroDeltaTable');
    expect(waterfallAt).toBeGreaterThan(-1);
    expect(slotAt).toBeGreaterThan(waterfallAt);
    expect(tableAt).toBeGreaterThan(slotAt);

    const lines = source.split('\n');
    const slotLine = lines.find((line) => line.includes('{slots.applyPanel ?? null}'));
    expect(slotLine?.trim()).toBe('{slots.applyPanel ?? null}');
  });
});

describe('TeamPlanScreenSlots', () => {
  it('typechecks with the applyPanel key absent', () => {
    const slots = {
      emptyState: () => null,
    } satisfies TeamPlanScreenSlots;
    expect(slots.applyPanel).toBeUndefined();
  });
});
