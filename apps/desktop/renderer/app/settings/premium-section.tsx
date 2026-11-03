import type {
  PremiumReportOutcome,
  PremiumSignInMethod,
  PremiumView,
  TrackingHistoryView,
} from '@bombfarm/contracts';
import { useEffect, useState } from 'react';
import { Banner, Button, ConfirmDialog, SettingsRow, SettingsSection, cn } from '@bombfarm/ui';
import { PREMIUM_SIGN_IN_END_COPY_KEY, sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { usePremium } from '../../lib/premium/use-premium';

const METHOD_COPY_KEY = {
  discord: 'settingsPremiumMethodDiscord',
  google: 'settingsPremiumMethodGoogle',
  steam: 'settingsPremiumMethodSteam',
} as const satisfies Record<PremiumSignInMethod, keyof Copy>;

const TRACKING_REASON_COPY_KEY = {
  binding_missing: 'premiumTrackingReasonBindingMissing',
  extension_missing: 'premiumTrackingReasonExtensionMissing',
  probe_failed: 'premiumTrackingReasonProbeFailed',
} as const satisfies Record<
  Extract<TrackingHistoryView, { state: 'engine_unavailable' }>['reason'],
  keyof Copy
>;

const TRACKING_RESULT_COPY_KEY = {
  cleared: 'premiumTrackingCleared',
  busy: 'premiumTrackingBusy',
  failed: 'premiumTrackingFailed',
} as const satisfies Record<string, keyof Copy>;

type TrackingBridge = {
  invoke(channel: 'premium:trackingHistory'): Promise<TrackingHistoryView>;
  invoke(
    channel: 'premium:clearTrackingHistory',
  ): Promise<{ ok: true } | { ok: false; error: 'busy' | 'failed' }>;
};

function trackingBridge(): TrackingBridge | undefined {
  return (window as unknown as { bfc?: TrackingBridge }).bfc;
}

function formatBytes(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(units.length - 1, Math.floor(Math.log2(Math.max(bytes, 1)) / 10));
  const value = bytes / 1024 ** unit;
  const digits = unit === 0 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} ${units[unit] ?? 'B'}`;
}

/** Shows the tracking history on disk and clears it after a confirm; hidden when there is none. */
export function TrackingHistoryRow() {
  const t = useCopy();
  const { bcp47 } = useLocale();
  const [history, setHistory] = useState<TrackingHistoryView>({ state: 'none' });
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<keyof typeof TRACKING_RESULT_COPY_KEY | null>(null);

  useEffect(() => {
    let live = true;
    void trackingBridge()
      ?.invoke('premium:trackingHistory')
      .then((view) => {
        if (live) setHistory(view);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const clear = async () => {
    const bridge = trackingBridge();
    if (bridge === undefined) return;
    let outcome: keyof typeof TRACKING_RESULT_COPY_KEY = 'failed';
    try {
      const reply = await bridge.invoke('premium:clearTrackingHistory');
      outcome = reply.ok ? 'cleared' : reply.error;
      if (reply.ok) setHistory({ state: 'none' });
    } catch {
      outcome = 'failed';
    }
    setResult(outcome);
  };

  if (history.state === 'none' && result === null) return null;

  const size = history.state !== 'none' && history.bytes !== null ? formatBytes(history.bytes, bcp47) : null;
  const help = [
    size === null ? null : sub(t.premiumTrackingSize, { size }),
    history.state === 'engine_unavailable'
      ? sub(t.premiumTrackingUnavailable, { reason: t[TRACKING_REASON_COPY_KEY[history.reason]] })
      : null,
    result === null ? null : t[TRACKING_RESULT_COPY_KEY[result]],
  ]
    .filter((line) => line !== null)
    .join(' ');

  return (
    <>
      <SettingsRow label={t.premiumTrackingLabel} help={help}>
        {history.state === 'none' ? null : (
          <Button
            type="button"
            variant="ghost"
            data-testid="settings-premium-tracking-clear"
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
          >
            {t.premiumTrackingClear}
          </Button>
        )}
      </SettingsRow>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.premiumTrackingConfirmTitle}
        description={t.premiumTrackingConfirmBody}
        confirmLabel={t.premiumTrackingConfirmAction}
        cancelLabel={t.premiumTrackingConfirmCancel}
        closeLabel={t.confirmDialogClose}
        onConfirm={() => {
          void clear();
        }}
      />
    </>
  );
}

function reportSentence(t: Copy, report: PremiumReportOutcome, accountId: string | null): string | null {
  if (report.kind === 'linked') return accountId === null ? null : sub(t.settingsPremiumReportLinked, { id: accountId });
  if (report.kind === 'not-sent') return t.settingsPremiumReportNotReadable;
  if (report.kind === 'refused') {
    if (report.reason === 'steam_mismatch') return t.settingsPremiumReportSteamMismatch;
    if (report.reason === 'no_steam_id') return t.settingsPremiumReportNoSteamId;
    if (report.reason === 'game_account_taken') return t.settingsPremiumReportAccountTaken;
  }
  return t.settingsPremiumReportFailed;
}

function messageFor(t: Copy, view: PremiumView): string {
  if (view.session === 'signed-in') return view.rememberedAcrossRestarts ? '' : t.settingsPremiumMemoryOnly;
  if (view.session === 'signing-in') return '';
  if (view.ended === 'expired') return t.settingsPremiumExpired;
  const key = view.lastSignInEnd === null ? null : PREMIUM_SIGN_IN_END_COPY_KEY[view.lastSignInEnd];
  return key === null ? '' : t[key];
}

export function PremiumSectionView({
  view,
  onSignIn,
  onCancel,
  onSignOut,
}: {
  view: PremiumView;
  onSignIn: () => void;
  onCancel: () => void;
  onSignOut: () => void;
}) {
  const t = useCopy();
  const message = messageFor(t, view);
  const reportLine =
    view.session === 'signed-in' && view.report !== null
      ? reportSentence(t, view.report, view.reportedAccountId)
      : null;
  const methods = (view.me?.methods ?? []).map((method) => t[METHOD_COPY_KEY[method]]);

  return (
    <SettingsSection title={t.settingsPremiumSectionTitle}>
      {view.session === 'signed-out' ? (
        <SettingsRow label={t.settingsPremiumSignInLabel} help={t.settingsPremiumSignInHelp}>
          <Button type="button" variant="default" data-testid="settings-premium-sign-in" onClick={onSignIn}>
            {t.settingsPremiumSignInAction}
          </Button>
        </SettingsRow>
      ) : view.session === 'signing-in' ? (
        <SettingsRow label={t.settingsPremiumSignInLabel} help={t.settingsPremiumSigningInHint}>
          <Button type="button" variant="ghost" data-testid="settings-premium-cancel" onClick={onCancel}>
            {t.settingsPremiumCancelAction}
          </Button>
        </SettingsRow>
      ) : (
        <SettingsRow
          label={t.settingsPremiumSignInLabel}
          help={methods.length > 0 ? sub(t.settingsPremiumSignedInWith, { methods: methods.join(', ') }) : t.settingsPremiumSignedIn}
        >
          <Button type="button" variant="ghost" data-testid="settings-premium-sign-out" onClick={onSignOut}>
            {t.settingsPremiumSignOutAction}
          </Button>
        </SettingsRow>
      )}
      <Banner
        tone="warn"
        data-testid="settings-premium-message"
        aria-hidden={message === ''}
        className={cn(message === '' && 'invisible')}
      >
        {message}
      </Banner>
      {reportLine === null ? null : <SettingsRow label={t.settingsPremiumGameAccountLabel} help={reportLine} />}
      <TrackingHistoryRow />
    </SettingsSection>
  );
}

export function PremiumSection() {
  const { view, signIn, cancelSignIn, signOut } = usePremium();
  return (
    <PremiumSectionView
      view={view}
      onSignIn={() => {
        void signIn();
      }}
      onCancel={() => {
        void cancelSignIn();
      }}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
