'use client';

import { useRef, useState, type ReactNode } from 'react';
import { buttonRecipe } from './button.recipe';
import { fileDropZoneRecipe } from './file-drop-zone.recipe';

export type FileDropZoneProps = {
  hint: ReactNode;
  chooseLabel: ReactNode;
  error?: ReactNode | null;
  accept?: string;
  onFile: (file: File) => void;
};

/**
 * Click / keyboard / drag-drop JSON file target. Promoted from import dialog (W6).
 * Keeps `role="button"`, `tabIndex={0}`, Enter/Space, and `event.target.value = ''` reset.
 */
export function FileDropZone({
  hint,
  chooseLabel,
  error = null,
  accept = 'application/json,.json',
  onFile,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={fileDropZoneRecipe({ dragOver })}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <span>{hint}</span>
      {/* Button-styled label, deliberately not a control: the outer role="button" div already
          handles click/keyboard activation, so a real nested <button> here would be an axe
          "nested-interactive" violation — two overlapping interactive elements with an
          ambiguous activation target. Wears `buttonRecipe` directly rather than the `Button`
          primitive, which is a Base UI button and warns (correctly) when rendered as a
          non-<button>; `nativeButton={false}` would silence that by restoring the very
          role="button" this needs not to have. */}
      <span className={buttonRecipe()}>{chooseLabel}</span>
      {error ? <p className="m-0 text-xs text-down">{error}</p> : null}
    </div>
  );
}
