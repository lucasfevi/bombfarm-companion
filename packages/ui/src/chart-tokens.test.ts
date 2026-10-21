import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './token-color';

const styles = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'styles.css'), 'utf8').replaceAll('\r\n', '\n');
const theme = styles.slice(styles.indexOf('@theme {'));
const themeLines = theme
  .slice(0, theme.indexOf('\n}\n'))
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^--[a-z\d-]+:/.test(line));

const EXISTING_THEME_LINES = [
  '--color-bg: oklch(18% 0.015 var(--hue));',
  '--color-bg-2: oklch(22% 0.018 var(--hue));',
  '--color-surface: oklch(24% 0.016 var(--hue));',
  '--color-ink: oklch(93% 0.012 var(--hue));',
  '--color-muted: oklch(70% 0.02 var(--hue));',
  '--color-line: oklch(35% 0.02 var(--hue));',
  '--color-accent: oklch(72% 0.14 55);',
  '--color-accent-ink: oklch(20% 0.03 55);',
  '--color-up: oklch(72% 0.14 150);',
  '--color-down: oklch(70% 0.15 25);',
  '--color-warn: oklch(55% 0.14 70);',
  '--color-info: #4f9cf0;',
  '--color-gold: #f5c84c;',
  '--color-rar-0: #9aa0a6;',
  '--color-rar-1: #7dce55;',
  '--color-rar-2: #4c79b4;',
  '--color-rar-3: #b176e0;',
  '--color-rar-4: #e3bc6f;',
  '--color-rar-5: #f08b68;',
  "--font-sans: var(--font-ibm-plex-sans), 'IBM Plex Sans', system-ui, sans-serif;",
  "--font-mono: var(--font-ibm-plex-mono), 'IBM Plex Mono', ui-monospace, monospace;",
  '--spacing-top: 58px;',
  '--container-app: 1520px;',
  '--container-desktop: 1440px;',
  '--container-settings: 768px;',
  '--shell-gutter: 1.5rem;',
  '--scrollbar: 10px;',
  '--breakpoint-compact: 1180px;',
  '--breakpoint-wide: 1500px;',
  '--animate-toast-in: toast-in 160ms ease-out;',
];

const SERIES = {
  '--color-series-1': '#cf7433',
  '--color-series-2': '#4f9bc9',
  '--color-series-3': '#5cc08a',
  '--color-series-4': '#b176e0',
} as const;

describe('chart series tokens', () => {
  it.each(Object.entries(SERIES))('defines %s as %s', (name, value) => {
    expect(themeLines).toContain(`${name}: ${value};`);
  });

  it('defines the chart grid colour from the line token', () => {
    expect(themeLines).toContain('--color-chart-grid: color-mix(in oklch, var(--color-line) 55%, transparent);');
  });

  it('leaves every pre-existing @theme declaration byte-identical, in order', () => {
    expect(themeLines.filter((line) => EXISTING_THEME_LINES.includes(line))).toEqual(EXISTING_THEME_LINES);
  });

  it('adds nothing to @theme beyond the series and grid tokens', () => {
    const added = themeLines.filter((line) => !EXISTING_THEME_LINES.includes(line));
    expect(added.map((line) => line.split(':')[0])).toEqual([...Object.keys(SERIES), '--color-chart-grid']);
  });

  it.each(Object.entries(SERIES))('%s is legible as a mark on the surface token (3:1)', (_name, value) => {
    expect(contrastRatio(value, 'oklch(24% 0.016 48)')).toBeGreaterThanOrEqual(3);
  });
});
