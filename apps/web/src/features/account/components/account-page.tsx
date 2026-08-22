'use client';

import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import { AccountColumn } from './account-column';
import { AccountSaveSummary } from './account-save-summary';

export function AccountPage() {
  return (
    <div className={workspaceClass}>
      <AccountColumn />
      <AccountSaveSummary />
    </div>
  );
}
