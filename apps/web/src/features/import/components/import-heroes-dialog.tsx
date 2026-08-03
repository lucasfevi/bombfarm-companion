'use client';

import { HiMiniXMark } from 'react-icons/hi2';
import type { Lang, Strings } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import { Dialog, FileDropZone } from '@bombfarm/ui';
import { dialogDescClass, importResetWarningClass } from '@bombfarm/ui/panel-field.recipe';
import { useImportCandidates, type ImportDialogResult } from '../hooks/use-import-candidates';
import { rejectionText } from '../model/compare-candidates';
import { ImportAccountSummary } from './import-account-summary';
import { ImportCandidateTable } from './import-candidate-table';
import { ImportSyncSummary } from './import-sync-summary';
import { ImportWarnings } from './import-warnings';
import { ImportDialogActions } from './import-dialog-actions';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: HeroRecord[];
  t: Strings;
  lang: Lang;
  onImported: (result: ImportDialogResult) => void;
};

export function ImportHeroesDialog({ open, onOpenChange, existing, t, lang, onImported }: Props) {
  const importState = useImportCandidates({ existing, t, onImported, onOpenChange });

  if (!open) return null;

  const hasAccountData = !!(importState.accountData && (importState.accountData.tree || importState.accountData.houseIdx != null));

  return (
    <Dialog.Root open={open} onOpenChange={importState.handleClose}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Head>
            <Dialog.Title>{t.importDialogTitle}</Dialog.Title>
            <Dialog.Close aria-label={t.importClose}>
              <HiMiniXMark size={16} aria-hidden="true" />
            </Dialog.Close>
          </Dialog.Head>

          <div className="min-h-0 flex-1 overflow-auto pr-0.5">
            <p className={dialogDescClass}>{t.importDialogDesc}</p>

            {!importState.candidates && (
              <FileDropZone
                hint={t.importDropHint}
                chooseLabel={t.importChooseFile}
                error={importState.fileError}
                onFile={(file) => void importState.handleFile(file)}
              />
            )}

            {importState.candidates && (
              <div>
                {importState.rejected ? (
                  // BSP-06/DEC-09/AC-36: a rejected file shows WHY, not "no heroes found".
                  <div className={importResetWarningClass} role="status">
                    <p className="m-0">{rejectionText(t, importState.rejected)}</p>
                  </div>
                ) : importState.candidates.length === 0 ? (
                  <p className="m-0 text-xs text-down">{importState.fileError ?? t.importNoHeroesFound}</p>
                ) : (
                  <>
                    {hasAccountData && importState.accountData && (
                      <ImportAccountSummary accountData={importState.accountData} t={t} lang={lang} />
                    )}

                    <ImportSyncSummary candidates={importState.candidates} existing={existing} t={t} />

                    <ImportCandidateTable
                      sorted={importState.sorted}
                      sort={{
                        sortKey: importState.sortKey,
                        sortDir: importState.sortDir,
                        onSort: importState.handleSort,
                      }}
                      expanded={importState.expanded}
                      onToggleExpand={(candidateId) =>
                        importState.setExpanded(importState.expanded === candidateId ? null : candidateId)
                      }
                    />
                    <ImportWarnings warnings={importState.warnings} t={t} />
                  </>
                )}
              </div>
            )}
          </div>

          <ImportDialogActions
            showTryAnother={importState.candidates != null}
            showConfirm={!!importState.candidates && importState.candidates.length > 0}
            candidateCount={importState.candidates?.length ?? 0}
            t={t}
            onTryAnother={importState.reset}
            onCancel={() => importState.handleClose(false)}
            onConfirm={importState.handleConfirm}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
