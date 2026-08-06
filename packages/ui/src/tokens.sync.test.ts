import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { breakpoints, colorTokens, DEFAULT_HUE, motionTokens } from './tokens';

const stylesPath = join(dirname(fileURLToPath(import.meta.url)), 'styles.css');
const styles = readFileSync(stylesPath, 'utf8');

/** Frozen MP1 planner palette — regression guard after token centralization (TOK-05). */
const FROZEN_THEME_COLORS: Record<string, string> = {
  '--color-rar-0': '#9aa0a6',
  '--color-rar-1': '#7dce55',
  '--color-rar-2': '#4c79b4',
  '--color-rar-3': '#b176e0',
  '--color-rar-4': '#e3bc6f',
  '--color-rar-5': '#f08b68',
  '--color-gold': '#f5c84c',
  '--color-info': '#4f9cf0',
  '--color-accent': 'oklch(72% 0.14 55)',
  '--color-bg': 'oklch(18% 0.015 var(--hue))',
  '--color-surface': 'oklch(24% 0.016 var(--hue))',
};

function themeColor(name: string): string | undefined {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^;\\n]+)`);
  return re.exec(styles)?.[1]?.trim();
}

describe('design tokens — CSS sync (TOK-04/05/06/08/12/13)', () => {
  it('exports all WIN-1 breakpoint boundaries in TS and CSS', () => {
    expect(breakpoints).toEqual({
      compactMax: 1179,
      regularMin: 1180,
      regularMax: 1500,
      wideMin: 1501,
    });
    expect(styles).toContain('--breakpoint-compact: 1180px');
    expect(styles).toContain('--breakpoint-wide: 1500px');
    expect(styles).toContain('--breakpoint-compact-max: 1179px');
    expect(styles).toContain('--breakpoint-regular-min: 1180px');
    expect(styles).toContain('--breakpoint-regular-max: 1500px');
    expect(styles).toContain('--breakpoint-wide-min: 1501px');
  });

  it('defines motion duration tokens and reduced-motion zeroing', () => {
    expect(styles).toContain(`--duration-micro: ${motionTokens.microMs}ms`);
    expect(styles).toContain(`--duration-panel: ${motionTokens.panelMs}ms`);
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('--duration-micro: 0ms');
    expect(styles).toContain('--duration-panel: 0ms');
  });

  it('preserves toast animation token and keyframes (TOK-13)', () => {
    expect(styles).toContain('--animate-toast-in: toast-in 160ms ease-out');
    expect(styles).toContain('@keyframes toast-in');
    expect(styles).toMatch(/@keyframes toast-in[\s\S]*from[\s\S]*opacity:\s*0/);
  });

  it('mirrors frozen @theme color values in styles.css (TOK-05)', () => {
    for (const [varName, expected] of Object.entries(FROZEN_THEME_COLORS)) {
      expect(themeColor(varName)).toBe(expected);
    }
  });

  it('mirrors hex rarity tokens in colorTokens', () => {
    for (let i = 0; i <= 5; i += 1) {
      const key = `rar${i}` as keyof typeof colorTokens;
      expect(styles).toContain(colorTokens[key].toLowerCase());
      expect(themeColor(`--color-rar-${i}`)?.toLowerCase()).toBe(colorTokens[key].toLowerCase());
    }
  });

  it('mirrors gold and info tokens', () => {
    expect(themeColor('--color-gold')).toBe(colorTokens.gold);
    expect(themeColor('--color-info')).toBe(colorTokens.info);
  });

  it('uses DEFAULT_HUE for neutral oklch in CSS', () => {
    expect(styles).toContain(`oklch(18% 0.015 var(--hue))`);
    expect(DEFAULT_HUE).toBe(48);
  });

  it('defines core @theme spacing and container tokens', () => {
    expect(styles).toContain('--spacing-top: 58px');
    expect(styles).toContain('--container-app: 1520px');
    expect(styles).toContain('--font-sans:');
    expect(styles).toContain('--font-mono:');
  });
});
