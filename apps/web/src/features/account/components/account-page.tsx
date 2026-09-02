'use client';

import { splitClass, workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import { AccountHoldingsSection } from './account-holdings-section';
import { AccountIdentityHeader } from './account-identity-header';
import { AccountHousePanel } from './account-house-panel';
import { AccountTreePanel } from './account-tree-panel';

export function AccountPage() {
  return (
    <div className={workspaceClass}>
      <AccountHoldingsSection />
      <AccountIdentityHeader />
      <div className={splitClass}>
        <AccountHousePanel />
        <AccountTreePanel />
      </div>
    </div>
  );
}
