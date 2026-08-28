'use client';

import { sub, type Strings } from '@/shared/i18n';
import { Button } from '@bombfarm/ui';
import { importActionsClass, importActionsEndClass } from '@bombfarm/ui/panel-field.recipe';

/** Confirm is enabled whenever at least one candidate exists; the
 *  `{count}` placeholder in `t.importConfirm` is the candidate count, not a selection. */
export function ImportDialogActions({
  showTryAnother,
  showConfirm,
  candidateCount,
  t,
  onTryAnother,
  onCancel,
  onConfirm,
}: {
  showTryAnother: boolean;
  showConfirm: boolean;
  candidateCount: number;
  t: Strings;
  onTryAnother: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={importActionsClass}>
      {showTryAnother && (
        <Button type="button" variant="ghost" onClick={onTryAnother}>
          {t.importTryAnother}
        </Button>
      )}
      <div className={importActionsEndClass}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.importCancel}
        </Button>
        {showConfirm && (
          <Button type="button" variant="primary" onClick={onConfirm}>
            {sub(t.importConfirm, { count: candidateCount })}
          </Button>
        )}
      </div>
    </div>
  );
}
