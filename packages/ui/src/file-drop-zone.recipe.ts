import { cva } from 'class-variance-authority';

/**
 * FileDropZone chrome — byte-for-byte from `import-heroes-dialog.tsx` idle/dragOver
 * class strings (W6 T4.1 / ASM-13). Empty cva `base`; variants emit full strings.
 */
export const fileDropZoneRecipe = cva('', {
  variants: {
    dragOver: {
      true: 'flex cursor-pointer flex-col items-center gap-2.5 border border-dashed border-accent bg-[color-mix(in_oklch,var(--accent)_8%,var(--bg))] px-4 py-8 text-center text-xs text-muted',
      false:
        'flex cursor-pointer flex-col items-center gap-2.5 border border-dashed border-line bg-bg px-4 py-8 text-center text-xs text-muted',
    },
  },
  defaultVariants: { dragOver: false },
});
