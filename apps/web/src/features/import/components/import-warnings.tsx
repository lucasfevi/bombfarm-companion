'use client';

import type { Strings } from '@/shared/i18n';
import { importWarningsClass } from '@bombfarm/ui/panel-field.recipe';

export function ImportWarnings({ warnings, t }: { warnings: string[]; t: Strings }) {
  if (warnings.length === 0) return null;
  return (
    <details className={importWarningsClass}>
      <summary>
        {t.importWarnings} ({warnings.length})
      </summary>
      <ul>
        {warnings.map((warning, index) => (
          <li key={index}>{warning}</li>
        ))}
      </ul>
    </details>
  );
}
