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

describe('EnergyBar — the reading', () => {
  it('fills the track to the fraction given, and prints it as a whole percentage', () => {
    const html = render(0.42);
    expect(fillWidth(html)).toBe('42%');
    expect(html).toMatch(/data-testid="live-energy-x-value"[^>]*>42%</);
  });

  it('floors rather than rounds, so only a hero at full energy reads 100%', () => {
    expect(render(0.996)).toMatch(/data-testid="live-energy-x-value"[^>]*>99%</);
    expect(render(1)).toMatch(/data-testid="live-energy-x-value"[^>]*>100%</);
  });

  it('clamps a fraction outside [0, 1] rather than overflowing the track', () => {
    expect(fillWidth(render(1.2))).toBe('100%');
    expect(fillWidth(render(-0.5))).toBe('0%');
  });
});

describe('EnergyBar — the fill and the reading agree', () => {
  it('draws the track to the same whole percentage the label prints, for every exact hundredth', () => {
    const disagreeing = Array.from({ length: 101 }, (_, i) => i).filter((i) => {
      const html = render(i / 100);
      const width = fillWidth(html);
      const label = /data-testid="live-energy-x-value"[^>]*>([^<]*)</.exec(html)?.[1];
      return width !== `${String(i)}%` || label !== `${String(i)}%`;
    });
    expect(disagreeing).toEqual([]);
  });
});

describe('EnergyBar — energy that was never sent', () => {
  it('reads as missing, never as 0% — an empty track alone would claim a hero has no energy', () => {
    const value = (html: string) => /data-testid="live-energy-x-value"[^>]*>([^<]*)</.exec(html)?.[1];
    expect(value(render(undefined))).toBe(en.fidelityStatusMissing);
    expect(value(render(0))).toBe('0%');
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
