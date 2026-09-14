'use client';

import { Button } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { sub } from '@/shared/i18n';
import { formatQuoteAge } from '@/shared/i18n/market-format';
import {
  selectAccountId,
  selectAccountImportedAt,
  selectHeroes,
  selectPlayerName,
  usePlannerStore,
} from '@/shared/stores';
import { shortAccountId } from '../model/account-id';
import { useInventoryViewSnapshot } from '../model/use-inventory-view-snapshot';

export function HomeStatusStrip() {
  const { t, lang } = useAppLang();
  const playerName = usePlannerStore(selectPlayerName);
  const accountId = usePlannerStore(selectAccountId);
  const heroes = usePlannerStore(selectHeroes);
  const importedAt = usePlannerStore(selectAccountImportedAt);
  const openImportDialog = usePlannerStore((state) => state.openImportDialog);
  const view = useInventoryViewSnapshot();

  const segments = [
    playerName ?? t.homeStripPlayerUnknown,
    accountId == null ? t.homeStripAccountIdUnknown : shortAccountId(accountId),
    sub(t.homeStripHeroes, { count: heroes.length }),
    ...(view == null ? [] : [sub(t.homeStripItems, { count: view.items.length })]),
    importedAt == null
      ? t.homeStripImportedUnknown
      : sub(t.homeStripImported, {
          age: formatQuoteAge(new Date(importedAt).toISOString(), lang),
        }),
  ];

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2"
      data-testid="home-status-strip"
    >
      <p className={`m-0 ${mutedClass}`} data-testid="home-status-strip-text">
        {segments.join(' · ')}
      </p>
      <Button onClick={openImportDialog}>{t.homeStripImport}</Button>
    </div>
  );
}
