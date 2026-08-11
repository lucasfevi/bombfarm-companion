/**
 * Design-system token registry — mirrors `styles.css` @theme / :root values.
 * Keep in sync when editing CSS (validated by tokens.sync.test.ts).
 */

export const DEFAULT_HUE = 48;

/** Resolved at DEFAULT_HUE for tests; CSS uses var(--hue) for neutrals. */
function neutral(l: number, c: number): string {
  return `oklch(${l}% ${c} ${DEFAULT_HUE})`;
}

export const colorTokens = {
  bg: neutral(18, 0.015),
  bg2: neutral(22, 0.018),
  surface: neutral(24, 0.016),
  ink: neutral(93, 0.012),
  muted: neutral(70, 0.02),
  line: neutral(35, 0.02),
  accent: 'oklch(72% 0.14 55)',
  accentInk: 'oklch(20% 0.03 55)',
  up: 'oklch(72% 0.14 150)',
  down: 'oklch(70% 0.15 25)',
  warn: 'oklch(55% 0.14 70)',
  info: '#4f9cf0',
  gold: '#f5c84c',
  rar0: '#9aa0a6',
  rar1: '#7dce55',
  rar2: '#4c79b4',
  rar3: '#b176e0',
  rar4: '#e3bc6f',
  rar5: '#f08b68',
} as const;

export type ColorTokenKey = keyof typeof colorTokens;

export const breakpoints = {
  compactMax: 1179,
  regularMin: 1180,
  regularMax: 1500,
  wideMin: 1501,
} as const;

export const motionTokens = {
  microMs: 120,
  panelMs: 200,
} as const;

export type ContrastPair = {
  fg: ColorTokenKey;
  bg: ColorTokenKey;
  minRatio: number;
};

/** DESIGN_SYSTEM §6 — AA normal text pairs. Rarity hues excluded (badges always pair color + text/glyph; rar-2 on bg ≈4.2:1). */
export const contrastPairs: readonly ContrastPair[] = [
  { fg: 'ink', bg: 'bg', minRatio: 4.5 },
  { fg: 'ink', bg: 'surface', minRatio: 4.5 },
  { fg: 'muted', bg: 'bg', minRatio: 4.5 },
  { fg: 'accentInk', bg: 'accent', minRatio: 4.5 },
  { fg: 'gold', bg: 'bg', minRatio: 4.5 },
  { fg: 'info', bg: 'bg', minRatio: 4.5 },
] as const;

/** @deprecated Use colorTokens — kept for AppShell-era imports until callers migrate. */
export const tokens = {
  color: {
    background: 'var(--bg)',
    foreground: 'var(--ink)',
    accent: 'var(--accent)',
    muted: 'var(--muted)',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  font: {
    sans: 'var(--font, ui-sans-serif, system-ui, sans-serif)',
  },
} as const;

/** @deprecated CSS lives in styles.css; import `@bombfarm/ui/styles.css` instead. */
export const cssVariables = '' as const;
