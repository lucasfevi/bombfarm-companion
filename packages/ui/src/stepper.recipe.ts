/**
 * Stepper / rank-control / check class sets — parity with the former
 * `control-chrome.ts` exports. These are fixed (no variants), so they stay as
 * documented recipe constants inside the reuse boundary.
 */

export const stepperClass = 'inline-flex items-center gap-1.5';
export const stepperBtnClass =
  'size-6 cursor-pointer rounded-sm border border-line bg-bg leading-none hover:border-accent motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]';
export const stepperValueClass =
  'inline-block w-[3ch] text-center font-mono text-xs tabular-nums';

export const rankCtlClass =
  'inline-flex shrink-0 items-stretch overflow-hidden rounded-sm border border-line bg-surface';
export const rankCtlBtnClass =
  'w-7 cursor-pointer border-none border-r border-line bg-bg-2 p-0 text-base leading-none text-ink hover:bg-[color-mix(in_oklch,var(--accent)_18%,var(--bg-2))] hover:text-accent disabled:cursor-not-allowed disabled:opacity-35 last:border-r-0 last:border-l last:border-line';
export const rankCtlReadoutClass =
  'inline-flex items-center gap-px px-1.5 min-w-[3.6rem] py-1 tabular-nums select-none';
export const rankCtlLvClass = 'mr-[3px] text-[9px] font-bold tracking-[0.04em] text-muted uppercase';
export const rankCtlValueClass = 'font-mono text-[13px] font-bold text-ink';
export const rankCtlMaxClass = 'font-mono text-[11px] text-muted';

export const checkClass = 'inline-flex items-center gap-1.5 text-xs text-muted';

/** Composite `Num` field — bordered shell + left spin column (replaces native spinners). */
export const numFieldClass =
  'inline-flex min-h-[34px] w-full min-w-0 items-stretch overflow-hidden rounded-sm border border-line bg-bg';
export const numSpinClass = 'flex w-5 shrink-0 flex-col border-r border-line bg-bg-2';
export const numSpinBtnClass =
  'flex flex-1 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted hover:bg-[color-mix(in_oklch,var(--accent)_18%,var(--bg-2))] hover:text-accent motion-safe:transition-[background-color,color] motion-safe:duration-[120ms]';
export const numInputClass =
  'min-w-0 flex-1 border-0 bg-transparent px-1.5 py-1.5 text-right text-[13px] text-ink tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none';
