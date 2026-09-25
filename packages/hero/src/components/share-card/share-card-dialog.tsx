'use client';

/**
 * The share card beside the controls that shape it, in a dialog.
 *
 * Everything the player sets here lives only as long as the dialog is open: the next open starts
 * again from the squad at the account's own phase, with the account number hidden.
 *
 * What only a host can supply comes in from outside — the DPS figures, which need the account the
 * host read, and turning the card into a picture on the clipboard, which needs the host's own
 * clipboard.
 */
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { Dialog, Icon } from '@bombfarm/ui';
import { shareCardCopyFor, type Lang } from '../../copy';
import {
  compareByPower,
  defaultShareCardSettings,
  shareCardLayout,
  type RosterHeroRow,
  type ShareCardSettings,
} from '../../model';
import { ShareCard, type ShareCardIdentity } from './share-card';
import { ShareCardControls, type ShareCopyStatus } from './share-card-controls';

export type ShareCardData = {
  readonly rows: readonly RosterHeroRow[];
  readonly identity: ShareCardIdentity & { readonly phase: number | null };
  /** The last phase the shipped tables describe — the far end of the phase control. */
  readonly lastKnownPhase: number;
  /** Sustained DPS by hero id at `phase`, for the heroes asked about. A hero the host could not
   *  work a figure out for is left out, and the card prints a dash for it. */
  readonly dpsAt: (phase: number, heroIds: readonly string[]) => ReadonlyMap<string, number>;
};

export type ShareCardActions = {
  /** Puts a picture of `card` on the clipboard; resolves whether it got there. */
  readonly copyImage: (card: HTMLElement) => Promise<boolean>;
};

const popupClass = '!w-[min(96vw,1080px)]';

export function ShareCardDialog({
  open,
  onOpenChange,
  data,
  actions,
  lang,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ShareCardData;
  actions: ShareCardActions;
  lang: Lang;
}) {
  const copy = shareCardCopyFor(lang);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className={popupClass} data-testid="share-card-dialog">
          <Dialog.Head>
            <Dialog.Title>{copy.dialogTitle}</Dialog.Title>
            <Dialog.Close aria-label={copy.dialogClose}>
              <Icon name="x-mark" size="sm" />
            </Dialog.Close>
          </Dialog.Head>
          <Dialog.Body>
            <ShareWorkspace data={data} actions={actions} lang={lang} />
          </Dialog.Body>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ShareWorkspace({ data, actions, lang }: { data: ShareCardData; actions: ShareCardActions; lang: Lang }) {
  const { rows, identity, lastKnownPhase, dpsAt } = data;
  const [settings, setSettings] = useState<ShareCardSettings>(() =>
    defaultShareCardSettings(rows, identity.phase, lastKnownPhase),
  );
  const [copyStatus, setCopyStatus] = useState<ShareCopyStatus>('idle');
  const cardRef = useRef<HTMLDivElement>(null);

  const onSettings = useCallback((patch: Partial<ShareCardSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setCopyStatus('idle');
  }, []);

  const strongestFirst = useMemo(() => [...rows].sort(compareByPower), [rows]);
  const layout = useMemo(
    () => shareCardLayout(rows, settings.picked, settings.feature),
    [rows, settings.picked, settings.feature],
  );
  // The slider answers at once and the card follows a frame behind, so a drag across two hundred
  // phases never waits on a card being redrawn at every one of them.
  const cardPhase = useDeferredValue(settings.phase);
  const cardSettings = useMemo(() => ({ ...settings, phase: cardPhase }), [settings, cardPhase]);
  const pickedIds = useMemo(() => layout.picked.map((row) => row.id), [layout.picked]);
  const dps = useMemo(() => dpsAt(cardPhase, pickedIds), [dpsAt, cardPhase, pickedIds]);

  const phaseBounds = useMemo(
    () => ({ accountPhase: identity.phase, lastKnownPhase }),
    [identity.phase, lastKnownPhase],
  );
  const onCopy = useCallback(() => {
    const card = cardRef.current;
    if (card === null) return;
    setCopyStatus('copying');
    actions.copyImage(card).then(
      (copied) => {
        setCopyStatus(copied ? 'copied' : 'failed');
      },
      () => {
        setCopyStatus('failed');
      },
    );
  }, [actions]);
  const copyControl = useMemo(() => ({ status: copyStatus, onCopy }), [copyStatus, onCopy]);

  return (
    // The card's own column is its fixed width, so beside the controls the two need 1060px.
    <div className="grid items-start gap-7 pb-4 min-[1060px]:grid-cols-[680px_minmax(260px,1fr)]">
      <div className="min-w-0 overflow-x-auto">
        <ShareCard ref={cardRef} layout={layout} settings={cardSettings} identity={identity} dps={dps} lang={lang} />
      </div>
      <ShareCardControls
        rows={strongestFirst}
        settings={settings}
        onSettings={onSettings}
        phaseBounds={phaseBounds}
        copyControl={copyControl}
        lang={lang}
      />
    </div>
  );
}
