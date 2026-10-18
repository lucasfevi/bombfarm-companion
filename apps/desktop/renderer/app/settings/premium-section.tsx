import type { PremiumReportOutcome, PremiumSignInMethod, PremiumView } from '@bombfarm/contracts';
import { Banner, Button, SettingsRow, SettingsSection, cn } from '@bombfarm/ui';
import { PREMIUM_SIGN_IN_END_COPY_KEY, sub, useCopy, type Copy } from '../../lib/copy';
import { usePremium } from '../../lib/premium/use-premium';

const METHOD_COPY_KEY = {
  discord: 'settingsPremiumMethodDiscord',
  google: 'settingsPremiumMethodGoogle',
  steam: 'settingsPremiumMethodSteam',
} as const satisfies Record<PremiumSignInMethod, keyof Copy>;

function reportSentence(t: Copy, report: PremiumReportOutcome, accountId: string | null): string {
  if (report.kind === 'linked') return sub(t.settingsPremiumReportLinked, { id: accountId ?? '' });
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
      {view.session === 'signed-in' && view.report !== null ? (
        <SettingsRow
          label={t.settingsPremiumGameAccountLabel}
          help={reportSentence(t, view.report, view.reportedAccountId)}
        />
      ) : null}
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
