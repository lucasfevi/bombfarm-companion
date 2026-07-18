/** Design-system token placeholders — expanded in M2. */
export const tokens = {
  color: {
    background: 'var(--bf-bg)',
    foreground: 'var(--bf-fg)',
    accent: 'var(--bf-accent)',
    muted: 'var(--bf-muted)',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  font: {
    sans: 'var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)',
  },
} as const;

export const cssVariables = `
  --bf-bg: #0b1020;
  --bf-fg: #e8edf7;
  --bf-accent: #f59e0b;
  --bf-muted: #64748b;
` as const;
