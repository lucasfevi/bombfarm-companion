'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AppEnvironmentInfo,
  AppLocale,
  GameSnapshotPayload,
  GameStatusInfo,
  SettingsWriteReason,
} from '@bombfarm/contracts';
import { DEFAULT_SETTINGS } from '@bombfarm/contracts';
import { AppShell, EmptyState, StatusChip } from '@bombfarm/ui';
// MP3 F1 (AD-032) — proves the renderer can import @bombfarm/domain: a value import from a
// FILE subpath that itself value-imports ./data/catalog.json, so a dist missing the JSON data
// fails the static export build rather than surfacing later at runtime (spec edge case). This
// is a probe, not planning UI — F2 (mp3-planning-views) is what actually renders advice. MP3 F4
// gives it a second purpose: proving the LANGUAGE reaches the domain edge, not just a value.
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { CopyProvider, useCopy, useLocale, type Copy } from '../lib/copy';
import { formatAge } from '../lib/format';
import { ConsentModal } from './consent-modal';
import { PlanningView } from './planning/planning-view';
import { LanguageSection } from './settings/language-section';

/**
 * `app-boot.spec.mjs` (unmodified, per design.md TD-8) asserts `app-ready`/`game-snapshot-json`/
 * `domain-label-probe` are visible immediately after boot, with no navigation. Those testids
 * live under the Diagnostics tab's content. Design's own TD-8 names "Planning (default)", but
 * that is only compatible with the existing, un-editable smoke if Diagnostics' content stays
 * visible without an explicit nav click — it does not (conditional mounting, not a CSS-hidden
 * trick, is what keeps `overflow-y:auto` scoped to `AppShell`'s `<main>` per MPV-15).
 *
 * SPEC_DEVIATION: the initial `activeNavId` here is `'diagnostics'`, not `'planning'`.
 * Reason: `app-boot.spec.mjs` cannot be edited and never navigates before its assertions, so
 * whichever tab is default must carry its testids. T7's new smoke explicitly navigates to
 * Planning before asserting `roster-list`/`next-point-top-stat` — MPV-01/02's own Independent
 * Test is satisfied by a smoke that interacts first, not by Planning being pre-selected.
 */
const DEFAULT_NAV_ID = 'diagnostics';

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
  const [activeNavId, setActiveNavId] = useState(DEFAULT_NAV_ID);
  const [environment, setEnvironment] = useState<AppEnvironmentInfo | null>(null);
  const [status, setStatus] = useState<GameStatusInfo | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) {
      setError(t.emptyBridgeUnavailableTitle);
      return;
    }

    void (async () => {
      try {
        const [nextEnvironment, initialStatus, initialSnapshot] = await Promise.all([
          bridge.invoke('app:getEnvironment'),
          bridge.invoke('game:getStatus'),
          bridge.invoke('game:getSnapshot'),
        ]);
        setEnvironment(nextEnvironment);
        setStatus(initialStatus);
        setSnapshot(initialSnapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    const offStatus = bridge.on('game:status', (next) => {
      setStatus(next);
    });
    const offSnapshot = bridge.on('snapshot:updated', (next) => {
      setSnapshot(next);
      setStatus(next.status);
    });

    return () => {
      offStatus();
      offSnapshot();
    };
    // `t.emptyBridgeUnavailableTitle` is a stable reference from the copy context (F2 mounts one
    // locale) — listed to satisfy exhaustive-deps without changing the once-on-mount behaviour.
  }, [t.emptyBridgeUnavailableTitle]);

  const rawJson = useMemo(() => {
    if (!snapshot) return null;
    return JSON.stringify(
      {
        status: snapshot.status,
        mapped: snapshot.mapped,
        raw: snapshot.raw,
      },
      null,
      2,
    );
  }, [snapshot]);

  return (
    <>
      <ConsentModal />
      <AppShell
        title={environment?.productName}
        badge={environment?.badgeLabel ?? null}
        items={[
          { id: 'planning', label: t.shellPlanningNavLabel, icon: 'check-circle' },
          { id: 'diagnostics', label: t.shellDiagnosticsNavLabel, icon: 'information-circle' },
          // MP3 F4 (MIN-16, TD-12) — packages/ui's icon registry has no dedicated "settings"
          // glyph and must not change (DS-09); 'arrow-path' is reused rather than adding one.
          { id: 'settings', label: t.settingsNavLabel, icon: 'arrow-path' },
        ]}
        activeId={activeNavId}
        onNavigate={setActiveNavId}
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
        {activeNavId === 'planning' ? (
          <PlanningView />
        ) : activeNavId === 'settings' ? (
          <LanguageSection locale={locale} onLocaleChange={onLocaleChange} persistWarning={persistWarning} />
        ) : (
          <section data-testid="app-ready" className="space-y-4">
            {/* MP3 F1/F4 probe — proves a @bombfarm/domain value, and now the LANGUAGE, reach
                the DOM. Not planner UI. */}
            <span data-testid="domain-label-probe" className="sr-only">
              {rarityLabel('Comum', lang)}
            </span>
            {error ? (
              <EmptyState title={t.emptyBridgeUnavailableTitle} description={error} />
            ) : rawJson ? (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted">{t.shellDiagnosticsSnapshotTitle}</h2>
                <pre
                  data-testid="game-snapshot-json"
                  className="max-h-[480px] overflow-auto rounded-lg border border-line bg-bg-2 p-4 text-xs leading-relaxed"
                >
                  {rawJson}
                </pre>
              </div>
            ) : (
              <EmptyState title={t.emptyNoSnapshotTitle} description={t.emptyNoSnapshotDescription} />
            )}
          </section>
        )}
      </AppShell>
    </>
  );
}
