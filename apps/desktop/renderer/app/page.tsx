'use client';

import { useEffect, useState } from 'react';
import type {
  AppEnvironmentInfo,
  AppLocale,
  GameStatusInfo,
  LiveDiagnosticsDumpOutcome,
  SettingsWriteReason,
} from '@bombfarm/contracts';
import { DEFAULT_SETTINGS } from '@bombfarm/contracts';
import { AppShell, BrandMark, SegmentedToggle, StatusChip } from '@bombfarm/ui';
// MP3 F1 (AD-032) — proves the renderer can import @bombfarm/domain: a value import from a
// FILE subpath that itself value-imports ./data/catalog.json, so a dist missing the JSON data
// fails the static export build rather than surfacing later at runtime (spec edge case). This
// is a probe, not planning UI — F2 (mp3-planning-views) is what actually renders advice. MP3 F4
// gives it a second purpose: proving the LANGUAGE reaches the domain edge, not just a value.
import { rarityLabel } from '@bombfarm/domain/game-labels';
import type { ConsentRecord } from '@bombfarm/game-api';
import { CopyProvider, useCopy, useLocale, type Copy } from '../lib/copy';
import { formatAge } from '../lib/format';
import { useOverlayInset } from '../lib/window-overlay';
import { navItemsFor } from './nav-items';
import { ConsentGate, isConsentGateVisible } from './consent-gate';
import { ConsentModal } from './consent-modal';
import { LiveView } from './live/live-view';
import { PlanningView } from './planning/planning-view';
import { ConsentSection } from './settings/consent-section';
import { DiagnosticsSection } from './settings/diagnostics-section';
import { LanguageSection } from './settings/language-section';

const DEFAULT_NAV_ID = 'live';

// Matches the shipped Settings language `Select` (MIN-16) — same two locales, same
// `onLocaleChange`, kept in sync only because both read/write the one `locale` state in `HomePage`.
const LOCALE_OPTIONS: ReadonlyArray<{ id: AppLocale; label: string }> = [
  { id: 'pt-BR', label: 'PT' },
  { id: 'en', label: 'EN' },
];

function statusLabel(status: GameStatusInfo['status'], t: Copy): string {
  switch (status) {
    case 'connected':
      return t.shellStatusConnected;
    case 'not_running':
      return t.shellStatusNotRunning;
    case 'stale':
      return t.shellStatusStale;
    default:
      return status;
  }
}

function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

export default function HomePage() {
  // MP3 F4 — locale state lives here, ABOVE CopyProvider, because CopyProvider needs it as a
  // prop; it cannot be read from the context it itself creates.
  const [locale, setLocale] = useState<AppLocale | null>(null);
  // MIN-11's surface half — null iff the last write persisted (or none has been attempted yet).
  const [persistWarning, setPersistWarning] = useState<SettingsWriteReason | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) {
      // No bridge ⇒ DEFAULT_SETTINGS.locale — never a blocked window, never a throw (F2's
      // bridge-unavailable posture, carried to the locale fetch).
      setLocale(DEFAULT_SETTINGS.locale);
      return;
    }
    void bridge
      .invoke('settings:get')
      .then((settings) => {
        setLocale(settings.locale);
      })
      .catch(() => {
        setLocale(DEFAULT_SETTINGS.locale);
      });
  }, []);

  useEffect(() => {
    if (!locale) return;
    // layout.tsx ships lang="en" as the static-export default (TD-9) — a prebuilt static export
    // cannot know the locale at build time. This is where the RUNTIME value is set. Not
    // unit-observable (renderToStaticMarkup never runs useEffect, AD-047) — asserted in T7's smoke.
    document.documentElement.lang = locale;
  }, [locale]);

  // MIN-08/MIN-11 — the shipped Select drives this. Applies first, always (result.settings.locale
  // is the applied value on every branch, AD-051/AD-052), then surfaces whether it persisted.
  const onLocaleChange = (next: AppLocale) => {
    const bridge = getBridge();
    if (!bridge) return;
    const channel = next === 'pt-BR' ? 'settings:usePortuguese' : 'settings:useEnglish';
    void bridge.invoke(channel).then((result) => {
      setLocale(result.settings.locale);
      setPersistWarning(result.persisted ? null : result.reason);
    });
  };

  return (
    <CopyProvider locale={locale ?? DEFAULT_SETTINGS.locale}>
      <HomePageContent
        locale={locale ?? DEFAULT_SETTINGS.locale}
        onLocaleChange={onLocaleChange}
        persistWarning={persistWarning}
      />
    </CopyProvider>
  );
}

function HomePageContent({
  locale,
  onLocaleChange,
  persistWarning,
}: {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  persistWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const overlayInset = useOverlayInset();
  const [activeNavId, setActiveNavId] = useState(DEFAULT_NAV_ID);
  const [environment, setEnvironment] = useState<AppEnvironmentInfo | null>(null);
  const [status, setStatus] = useState<GameStatusInfo | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [consentForceOpen, setConsentForceOpen] = useState(false);
  const [diagnosticsDumpResult, setDiagnosticsDumpResult] = useState<LiveDiagnosticsDumpOutcome | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;

    void bridge
      .invoke('consent:get')
      .then((current) => {
        setConsent(current);
      })
      .catch(() => {});

    return bridge.on('consent:changed', (next) => {
      setConsent(next);
    });
  }, []);

  const onConsentRevoke = () => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('consent:revoke').then((next) => {
      setConsent(next);
    });
  };

  const onConsentReallow = () => {
    setConsentForceOpen(true);
  };

  const onSaveDiagnostics = () => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('live:dumpDiagnostics').then((result) => {
      setDiagnosticsDumpResult(result);
    });
  };

  const onConsentDecided = () => {
    setConsentForceOpen(false);
  };

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;

    void (async () => {
      try {
        const [nextEnvironment, initialStatus] = await Promise.all([
          bridge.invoke('app:getEnvironment'),
          bridge.invoke('game:getStatus'),
        ]);
        setEnvironment(nextEnvironment);
        setStatus(initialStatus);
      } catch {
        // Left null — the shell already renders a loading state, and `game:status` below
        // keeps arriving on its own regardless of whether this initial read succeeded.
      }
    })();

    return bridge.on('game:status', (next) => {
      setStatus(next);
    });
  }, []);

  const consentLoaded = consent !== null;
  const gated = isConsentGateVisible(consent);
  const granted = consentLoaded && !gated;

  return (
    <>
      <ConsentModal forceOpen={consentForceOpen} onDecided={onConsentDecided} />
      <AppShell
        title={environment?.productName}
        badge={environment?.badgeLabel ?? null}
        items={granted ? navItemsFor(t) : []}
        activeId={activeNavId}
        onNavigate={setActiveNavId}
        brand={<BrandMark />}
        draggable
        overlayInset={overlayInset}
        actions={
          <SegmentedToggle
            options={LOCALE_OPTIONS}
            value={locale}
            onChange={(id) => {
              if (id === 'en' || id === 'pt-BR') onLocaleChange(id);
            }}
            ariaLabel={t.consentGateLanguageLabel}
          />
        }
        status={
          <span data-testid="game-status-chip">
            {status ? (
              <StatusChip
                status={status.status}
                label={statusLabel(status.status, t)}
                ageLabel={status.staleAgeMs != null ? formatAge(status.staleAgeMs, t) : undefined}
              />
            ) : (
              t.shellLoadingLabel
            )}
          </span>
        }
        version={
          environment ? (
            <>
              <span data-testid="app-version" className="font-mono tabular-nums">
                v{environment.version}
              </span>
              {environment.flavor !== 'prod' && environment.badgeLabel ? (
                <span className="text-xs font-semibold uppercase tracking-wide">{environment.badgeLabel}</span>
              ) : null}
            </>
          ) : null
        }
      >
        {/* `app-ready` marks the renderer as mounted, so it belongs to the shell and not to
            whichever tab happens to be showing — six smoke specs wait on it purely as a boot
            signal. The probe beside it proves a @bombfarm/domain value and the active language
            reached the DOM; it is not planner UI. */}
        <div data-testid="app-ready" className="space-y-4">
          <span data-testid="domain-label-probe" className="sr-only">
            {rarityLabel('Comum', lang)}
          </span>
          {!consentLoaded ? null : gated ? (
            <ConsentGate locale={locale} onLocaleChange={onLocaleChange} onReadAgain={onConsentReallow} />
          ) : activeNavId === 'settings' ? (
            <>
              <LanguageSection locale={locale} onLocaleChange={onLocaleChange} persistWarning={persistWarning} />
              <ConsentSection onRevoke={onConsentRevoke} />
              <DiagnosticsSection onSave={onSaveDiagnostics} result={diagnosticsDumpResult} />
            </>
          ) : activeNavId === 'planning' ? (
            <PlanningView />
          ) : (
            <LiveView onReopenConsent={onConsentReallow} />
          )}
        </div>
      </AppShell>
    </>
  );
}
