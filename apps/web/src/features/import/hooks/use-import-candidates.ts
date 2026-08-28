'use client';

import { useMemo, useState } from 'react';
import { parseSaveFile, type AccountImportData, type ImportCandidate, type ParseRejection } from '@bombfarm/domain/import-save';
import type { RequiredAccountField } from '@bombfarm/domain/account-required-fields';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { saveInventoryView } from '@/shared/lib/inventory-view-storage';
import { importHeroes, type HeroRecord } from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores';
import type { Strings } from '@/shared/i18n';
import {
  compareCandidates,
  type ImportSortDir,
  type ImportSortKey,
} from '../model/compare-candidates';

export type ImportDialogResult = {
  heroes: HeroRecord[];
  created: number;
  updated: number;
  removed: number;
  account: AccountImportData | null;
  accountMissingRequired: readonly RequiredAccountField[];
};

export type UseImportCandidatesArgs = {
  existing: HeroRecord[];
  t: Strings;
  onImported: (result: ImportDialogResult) => void;
  onOpenChange: (open: boolean) => void;
};

/**
 * The dialog reviews a full roster sync; it no longer curates a
 * selection. `selected`/`toggle`/`toggleAll`/`allSelected`/`someSelected` are gone (T13):
 * confirm is enabled whenever at least one candidate exists, and every non-blocked candidate
 * is written. `handleConfirm` passes the save's own `sourceId` set as `importHeroes`' third
 * argument — a blocked candidate is excluded from `records` but its `sourceId`
 * still counts toward that set, so an existing hero with that `sourceId` is preserved, not
 * removed (`W5`).
 */
export function useImportCandidates({
  existing,
  t,
  onImported,
  onOpenChange,
}: UseImportCandidatesArgs) {
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rejected, setRejected] = useState<ParseRejection | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<AccountImportData | null>(null);
  const [accountMissingRequired, setAccountMissingRequired] = useState<readonly RequiredAccountField[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryViewItems, setInventoryViewItems] = useState<InventoryViewItem[]>([]);
  const [sortKey, setSortKey] = useState<ImportSortKey>('power');
  const [sortDir, setSortDir] = useState<ImportSortDir>('desc');

  const sorted = useMemo(() => {
    if (!candidates) return [];
    return [...candidates].sort((left, right) => compareCandidates(left, right, sortKey, sortDir));
  }, [candidates, sortKey, sortDir]);

  function reset() {
    setCandidates(null);
    setWarnings([]);
    setRejected(null);
    setFileError(null);
    setAccountData(null);
    setAccountMissingRequired([]);
    setInventoryItems([]);
    setInventoryViewItems([]);
    setSortKey('power');
    setSortDir('desc');
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File) {
    setFileError(null);
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setFileError(t.importInvalidJson);
      return;
    }
    const {
      candidates: found,
      warnings: warn,
      account,
      rejected: rejectedResult,
      inventory,
      inventoryView,
      accountMissingRequired: missingRequired,
    } = parseSaveFile(raw, existing);
    setCandidates(found);
    setWarnings(warn);
    setRejected(rejectedResult);
    setAccountData(account);
    setAccountMissingRequired(missingRequired);
    setInventoryItems(inventory);
    setInventoryViewItems(inventoryView);
    setSortKey('power');
    setSortDir('desc');
  }

  function handleSort(key: ImportSortKey) {
    if (sortKey === key) {
      setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'rank' ? 'asc' : 'desc');
    }
  }

  function handleConfirm() {
    if (!candidates || candidates.length === 0) return;
    const records = candidates
      .filter((candidate) => !candidate.blocked)
      .map((candidate) => ({ ...candidate.record, sourceId: candidate.sourceId }));
    // The save's own sourceId set, blocked candidates included — importHeroes removes
    // any existing hero whose sourceId is absent from it, in the same write.
    const saveSourceIds = new Set(candidates.map((candidate) => candidate.sourceId));
    const result = importHeroes(usePlannerStore.getState().heroes, records, saveSourceIds);
    usePlannerStore.getState().replaceInventoryFromImport(inventoryItems);
    saveInventoryView(inventoryViewItems);
    onImported({ ...result, account: accountData, accountMissingRequired });
    handleClose(false);
  }

  return {
    candidates,
    warnings,
    rejected,
    fileError,
    accountData,
    sortKey,
    sortDir,
    sorted,
    reset,
    handleClose,
    handleFile,
    handleSort,
    handleConfirm,
  };
}
