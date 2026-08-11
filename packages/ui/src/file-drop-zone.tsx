'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
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
      {/* Decorative label, not a second control: the outer role="button" div already
          handles click/keyboard activation (onFile fires from its own onClick /
          onKeyDown above), so a real nested <button> here would be an axe
          "nested-interactive" violation — two overlapping interactive elements with
          ambiguous activation target for screen reader / keyboard users. Render as a
          <span> (Base UI `render`) with tabIndex={-1}, matching the documented pattern
          for a trigger nested inside an already-focusable ancestor (see
          AbbreviatedNumber / docs/design-system.md "Tooltip trigger nested inside
          another interactive control"). */}
      <Button type="button" render={<span />} tabIndex={-1}>
        {chooseLabel}
      </Button>
      {error ? <p className="m-0 text-xs text-down">{error}</p> : null}
    </div>
  );
}
