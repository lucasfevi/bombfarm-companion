/**
 * Checkbox chrome — Base UI Root + Indicator dressed with planner tokens. The box is 16px so a
 * dense table row (32px item icon, 6px cell padding) keeps its height with one in it.
 */

const transition =
  'motion-safe:transition-[background-color,border-color] motion-safe:duration-[140ms] motion-safe:ease-out';

export const checkboxRootClass = `grid size-4 shrink-0 cursor-pointer place-items-center rounded-[3px] border border-line bg-bg-2 p-0 text-accent-ink outline-none select-none ${transition} data-[checked]:border-accent data-[checked]:bg-accent focus-visible:border-accent focus-visible:outline-2 focus-visible:[outline-style:solid] focus-visible:outline-offset-2 focus-visible:outline-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40`;

export const checkboxIndicatorClass = 'grid place-items-center';
