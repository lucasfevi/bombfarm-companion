'use client';

import { splitClass, workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import { AccountIdentityHeader } from './account-identity-header';
import { AccountHousePanel } from './account-house-panel';
import { AccountTreePanel } from './account-tree-panel';

export function AccountPage() {
  return (
    <div className={workspaceClass}>
      <AccountIdentityHeader />
      <div className={splitClass}>
        <AccountHousePanel />
        <AccountTreePanel />
      </div>
    </div>
  );
}
