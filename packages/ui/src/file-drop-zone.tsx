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
      <Button type="button">{chooseLabel}</Button>
      {error ? <p className="m-0 text-xs text-down">{error}</p> : null}
    </div>
  );
}
