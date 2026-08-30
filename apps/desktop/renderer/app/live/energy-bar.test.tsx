import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS } from '../../lib/copy';
import { EnergyBar } from './energy-bar';

const en = STRINGS.en;

function render(fraction: number | undefined) {
  return renderToStaticMarkup(createElement(EnergyBar, { testId: 'live-energy-x', fraction }));
}

function fillWidth(html: string): string | undefined {
  return /style="width:([^"]*)"/.exec(html)?.[1]?.trim();
}

describe('EnergyBar — the track', () => {
  it('fills the track to the fraction given, as a whole percentage', () => {
    expect(fillWidth(render(0.42))).toBe('42%');
  });

  it('floors rather than rounds, so only a hero at full energy fills the track completely', () => {
    expect(fillWidth(render(0.996))).toBe('99%');
    expect(fillWidth(render(1))).toBe('100%');
  });

  it('clamps a fraction outside [0, 1] rather than overflowing the track', () => {
    expect(fillWidth(render(1.2))).toBe('100%');
    expect(fillWidth(render(-0.5))).toBe('0%');
  });

  it('draws every exact hundredth to the matching whole-percent width', () => {
    const disagreeing = Array.from({ length: 101 }, (_, i) => i).filter(
      (i) => fillWidth(render(i / 100)) !== `${String(i)}%`,
    );
    expect(disagreeing).toEqual([]);
  });
});

describe('EnergyBar — energy that was never sent', () => {
  it('renders the empty track, the same shape a real zero reading would draw', () => {
    expect(fillWidth(render(undefined))).toBe('0%');
  });

  it('still renders the row, so a card with no energy figure is the same height as one with', () => {
    const missing = render(undefined);
    const known = render(0.5);
    expect(missing).toContain('data-testid="live-energy-x"');
    expect(fillWidth(missing)).toBe('0%');
    expect(fillWidth(known)).toBe('50%');
  });
});

describe('EnergyBar — the label', () => {
  it('names the reading for a screen reader, since the bar itself carries no words', () => {
    expect(render(0.5)).toContain(en.liveEnergyLabel);
  });
});
