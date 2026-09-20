'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppEnvironmentInfo,
  AppLocale,
  GameStatusInfo,
  LiveDiagnosticsDumpOutcome,
  MarketQuoteCurrency,
  SettingsWriteReason,
  UpdateStatus,
} from '@bombfarm/contracts';
import { DEFAULT_SETTINGS, idleUpdateStatus } from '@bombfarm/contracts';
import {
  AppShell,
  BrandMark,
  useShellDensity,
  WINDOW_CONTROLS_WIDTH,
} from '@bombfarm/ui';
// Proves the renderer can import @bombfarm/domain: a value import from a
// FILE subpath that itself value-imports ./data/catalog.json, so a dist missing the JSON data
// fails the static export build rather than surfacing later at runtime. It also carries a
// second purpose: proving the LANGUAGE reaches the domain edge, not just a value.
import { rarityLabel } from '@bombfarm/domain/game-labels';
import type { ConsentRecord } from '@bombfarm/game-api';
import { CopyProvider, useCopy, useLocale } from '../lib/copy';
import { useTabScrollMemory } from '../lib/use-tab-scroll-memory';
import { navItemsFor } from './nav-items';
import { ShellActions } from './shell-actions';
import { ShellWindowControls } from './shell-window-controls';
import { ConsentGate, isConsentGateVisible } from './consent-gate';
import { ConsentModal } from './consent-modal';
import { UpdateChip } from './update-chip';
import { LiveView } from './live/live-view';
import { FarmView } from './farm/farm-view';
import { HeroesView } from './heroes/heroes-view';
import { InventoryView } from './inventory/inventory-view';
import { ForgeQueueBar, isForgeQueueShown } from './forge/forge-queue-bar';
import { FeedsRail } from './feeds-rail';
import { GameFeed, liveTabMark } from './game-feed';
import { useFeeds } from '../lib/feeds/use-feeds';
import { useForgeQueue } from '../lib/forge/forge-queue-store';
import { ForgeView } from './forge/forge-view';
import { OptimizerView } from './optimizer/optimizer-view';
import { PvpView } from './pvp/pvp-view';
import { SkillsView } from './skills/skills-view';
import { AccountView } from './account/account-view';
import { ConsentSection } from './settings/consent-section';
import { ForgeSection } from './settings/forge-section';
import { GameSection } from './settings/game-section';
import { DiagnosticsSection } from './settings/diagnostics-section';
import { LanguageSection } from './settings/language-section';
import { MarketSection } from './settings/market-section';
import { SupportSection } from './settings/support-section';
import { UpdatesSection } from './settings/updates-section';
import { WindowSection } from './settings/window-section';

const DEFAULT_NAV_ID = 'live';

function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

export default function HomePage() {
  // Locale state lives here, ABOVE CopyProvider, because CopyProvider needs it as a
  // prop; it cannot be read from the context it itself creates.
  const [locale, setLocale] = useState<AppLocale | null>(null);
  // The unwritable-settings-surfaced rule's surface half — null iff the last write persisted (or none has been attempted yet).
  const [persistWarning, setPersistWarning] = useState<SettingsWriteReason | null>(null);
  const [alwaysOnTopMain, setAlwaysOnTopMain] = useState(DEFAULT_SETTINGS.alwaysOnTopMain);
  const [alwaysOnTopWarning, setAlwaysOnTopWarning] = useState<SettingsWriteReason | null>(null);
  const [alwaysOnTopMini, setAlwaysOnTopMini] = useState(DEFAULT_SETTINGS.alwaysOnTopMini);
  const [alwaysOnTopMiniWarning, setAlwaysOnTopMiniWarning] = useState<SettingsWriteReason | null>(null);
  const [forgeWritesEnabled, setForgeWritesEnabled] = useState(DEFAULT_SETTINGS.forgeWritesEnabled);
  const [forgeWritesWarning, setForgeWritesWarning] = useState<SettingsWriteReason | null>(null);
  const [restartGameOnExit, setRestartGameOnExit] = useState(DEFAULT_SETTINGS.restartGameOnExit);
  const [restartGameOnExitWarning, setRestartGameOnExitWarning] = useState<SettingsWriteReason | null>(null);
  const [marketQuoteCurrency, setMarketQuoteCurrency] = useState<MarketQuoteCurrency>(DEFAULT_SETTINGS.marketQuoteCurrency);
  const [marketQuoteCurrencyWarning, setMarketQuoteCurrencyWarning] = useState<SettingsWriteReason | null>(null);

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
        setAlwaysOnTopMain(settings.alwaysOnTopMain);
        setAlwaysOnTopMini(settings.alwaysOnTopMini);
        setForgeWritesEnabled(settings.forgeWritesEnabled);
        setRestartGameOnExit(settings.restartGameOnExit);
        setMarketQuoteCurrency(settings.marketQuoteCurrency);
      })
      .catch(() => {
        setLocale(DEFAULT_SETTINGS.locale);
      });
  }, []);

  useEffect(() => {
    if (!locale) return;
    // layout.tsx ships lang="en" as the static-export default — a prebuilt static export
    // cannot know the locale at build time. This is where the RUNTIME value is set. Not
    // unit-observable (renderToStaticMarkup never runs useEffect) — asserted in T7's smoke.
    document.documentElement.lang = locale;
  }, [locale]);

  // The shipped Select drives this. Applies first, always (result.settings.locale
  // is the applied value on every branch), then surfaces whether it persisted.
  const onLocaleChange = (next: AppLocale) => {
    const bridge = getBridge();
    if (!bridge) return;
    const channel = next === 'pt-BR' ? 'settings:usePortuguese' : 'settings:useEnglish';
    void bridge.invoke(channel).then((result) => {
      setLocale(result.settings.locale);
      setPersistWarning(result.persisted ? null : result.reason);
    });
  };

  const onAlwaysOnTopMainChange = (next: boolean) => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('settings:setAlwaysOnTopMain', next).then((result) => {
      setAlwaysOnTopMain(result.settings.alwaysOnTopMain);
      setAlwaysOnTopWarning(result.persisted ? null : result.reason);
    });
  };

  const onAlwaysOnTopMiniChange = (next: boolean) => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('settings:setAlwaysOnTopMini', next).then((result) => {
      setAlwaysOnTopMini(result.settings.alwaysOnTopMini);
      setAlwaysOnTopMiniWarning(result.persisted ? null : result.reason);
    });
  };

  const onForgeWritesEnabledChange = (next: boolean) => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('settings:setForgeWritesEnabled', next).then((result) => {
      setForgeWritesEnabled(result.settings.forgeWritesEnabled);
      setForgeWritesWarning(result.persisted ? null : result.reason);
    });
  };

  const onRestartGameOnExitChange = (next: boolean) => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('settings:setRestartGameOnExit', next).then((result) => {
      setRestartGameOnExit(result.settings.restartGameOnExit);
      setRestartGameOnExitWarning(result.persisted ? null : result.reason);
    });
  };

  const onMarketQuoteCurrencyChange = (next: MarketQuoteCurrency) => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('settings:setMarketQuoteCurrency', next).then((result) => {
      setMarketQuoteCurrency(result.settings.marketQuoteCurrency);
      setMarketQuoteCurrencyWarning(result.persisted ? null : result.reason);
    });
  };

  return (
    <CopyProvider locale={locale ?? DEFAULT_SETTINGS.locale}>
      <HomePageContent
        locale={locale ?? DEFAULT_SETTINGS.locale}
        onLocaleChange={onLocaleChange}
        persistWarning={persistWarning}
        alwaysOnTopMain={alwaysOnTopMain}
        onAlwaysOnTopMainChange={onAlwaysOnTopMainChange}
        alwaysOnTopWarning={alwaysOnTopWarning}
        alwaysOnTopMini={alwaysOnTopMini}
        onAlwaysOnTopMiniChange={onAlwaysOnTopMiniChange}
        alwaysOnTopMiniWarning={alwaysOnTopMiniWarning}
        forgeWritesEnabled={forgeWritesEnabled}
        onForgeWritesEnabledChange={onForgeWritesEnabledChange}
        forgeWritesWarning={forgeWritesWarning}
        restartGameOnExit={restartGameOnExit}
        onRestartGameOnExitChange={onRestartGameOnExitChange}
        restartGameOnExitWarning={restartGameOnExitWarning}
        marketQuoteCurrency={marketQuoteCurrency}
        onMarketQuoteCurrencyChange={onMarketQuoteCurrencyChange}
        marketQuoteCurrencyWarning={marketQuoteCurrencyWarning}
      />
    </CopyProvider>
  );
}

function HomePageContent({
  locale,
  onLocaleChange,
  persistWarning,
  alwaysOnTopMain,
  onAlwaysOnTopMainChange,
  alwaysOnTopWarning,
  alwaysOnTopMini,
  onAlwaysOnTopMiniChange,
  alwaysOnTopMiniWarning,
  forgeWritesEnabled,
  onForgeWritesEnabledChange,
  forgeWritesWarning,
  restartGameOnExit,
  onRestartGameOnExitChange,
  restartGameOnExitWarning,
  marketQuoteCurrency,
  onMarketQuoteCurrencyChange,
  marketQuoteCurrencyWarning,
}: {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  persistWarning: SettingsWriteReason | null;
  alwaysOnTopMain: boolean;
  onAlwaysOnTopMainChange: (next: boolean) => void;
  alwaysOnTopWarning: SettingsWriteReason | null;
  alwaysOnTopMini: boolean;
  onAlwaysOnTopMiniChange: (next: boolean) => void;
  alwaysOnTopMiniWarning: SettingsWriteReason | null;
  forgeWritesEnabled: boolean;
  onForgeWritesEnabledChange: (next: boolean) => void;
  forgeWritesWarning: SettingsWriteReason | null;
  restartGameOnExit: boolean;
  onRestartGameOnExitChange: (next: boolean) => void;
  restartGameOnExitWarning: SettingsWriteReason | null;
  marketQuoteCurrency: MarketQuoteCurrency;
  onMarketQuoteCurrencyChange: (next: MarketQuoteCurrency) => void;
  marketQuoteCurrencyWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  // The caption cluster is subtracted before the bar is judged: it sits at the end of the same
  // row and never shrinks, so the room the tabs and actions are competing for is what is left
  // after it.
  const density = useShellDensity(WINDOW_CONTROLS_WIDTH);
  const mainRef = useRef<HTMLElement | null>(null);
  const [activeNavId, setActiveNavId] = useTabScrollMemory(DEFAULT_NAV_ID, mainRef);
  // Stable on purpose: the Farm screen folds it into the hand-memoised action bag that reaches
  // its 600-row table, and a fresh lambda per shell render would invalidate that bag every tick.
  const openOptimizerTab = useCallback(() => {
    setActiveNavId('optimizer');
  }, [setActiveNavId]);
  const [environment, setEnvironment] = useState<AppEnvironmentInfo | null>(null);
  const [status, setStatus] = useState<GameStatusInfo | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [consentForceOpen, setConsentForceOpen] = useState(false);
  const [diagnosticsDumpResult, setDiagnosticsDumpResult] = useState<LiveDiagnosticsDumpOutcome | null>(null);
  // Seeded rather than null so the Updates section renders on first paint, and seeded `idle`
  // because that is the one phase that claims nothing: `disabled` is a statement about the build
  // that this component is in no position to make before main has answered.
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(() => idleUpdateStatus('', null));

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

    void bridge
      .invoke('updates:get')
      .then(setUpdateStatus)
      .catch(() => {});

    // Every transition arrives here, including the ones nobody clicked for: download progress
    // and the periodic background check.
    return bridge.on('updates:changed', setUpdateStatus);
  }, []);

  // Stable, because the status strip's rail keys its refresh-all sequence on the presses it holds.
  const onUpdateCheck = useCallback(async (): Promise<UpdateStatus | null> => {
    const bridge = getBridge();
    if (!bridge) return null;
    const status = await bridge.invoke('updates:check');
    setUpdateStatus(status);
    return status;
  }, []);

  const onUpdateDownload = () => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('updates:download').then(setUpdateStatus);
  };

  const onUpdateInstall = () => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('updates:installOnRestart').then(setUpdateStatus);
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
  // The shell draws the band only while there is a queue to show: an element that renders null
  // would still claim the strip's height on every screen.
  const forgeQueueShown = isForgeQueueShown(useForgeQueue());
  // The status strip's rail: every feed the app keeps asking for, with the account item speaking
  // for the screen on show when that screen computes from a copy of its own.
  const feeds = useFeeds({ activeTabId: activeNavId, updateStatus, onUpdateCheck });
  // The Live tab wears the game's state at its corner — the same words the strip's game cell says.
  const liveMark = liveTabMark(status, t);
  const navItems = navItemsFor(t).map((item) => (item.id === 'live' ? { ...item, mark: liveMark } : item));

  return (
    <>
      <ConsentModal forceOpen={consentForceOpen} onDecided={onConsentDecided} />
      <AppShell
        badge={environment?.badgeLabel ?? null}
        density={density}
        items={granted ? navItems : []}
        activeId={activeNavId}
        onNavigate={setActiveNavId}
        brand={<BrandMark />}
        draggable
        windowControls={<ShellWindowControls />}
        mainRef={mainRef}
        actions={
          <ShellActions
            density={density}
            granted={granted}
            locale={locale}
            onLocaleChange={onLocaleChange}
          />
        }
        status={<GameFeed status={status} />}
        banner={
          granted && forgeQueueShown ? (
            <ForgeQueueBar
              forgeWritesEnabled={forgeWritesEnabled}
              accountSource={environment?.accountSource ?? null}
              onOpenForge={() => {
                setActiveNavId('forge');
              }}
            />
          ) : null
        }
        version={
          environment ? (
            <>
              {/* The feeds rail and the update chip sit at the right, beside the version, and only
                  while consent is granted: the chip's whole action is reaching Settings, and the
                  nav it would reach does not exist until then. */}
              {granted ? <FeedsRail {...feeds} activeTabId={activeNavId} /> : null}
              {granted ? (
                <UpdateChip
                  status={updateStatus}
                  onOpenSettings={() => {
                    setActiveNavId('settings');
                  }}
                />
              ) : null}
              {/* The flavor is NOT repeated here. It is the header's badge, four words from the
                  app's own name, which is where "which build am I running" is actually asked; a
                  second copy beside the version said the same word twice in one small window. */}
              <span data-testid="app-version" className="font-mono tabular-nums">
                v{environment.version}
              </span>
            </>
          ) : null
        }
      >
        {/* `app-ready` marks the renderer as mounted, so it belongs to the shell and not to
            whichever tab happens to be showing — six smoke specs wait on it purely as a boot
            signal. The probe beside it proves a @bombfarm/domain value and the active language
            reached the DOM; it renders nothing a player sees. */}
        {/* Fills the shell's measure, which is at least the region and as tall as the tab beyond
            that — never pinned to the region, or a taller tab overflows it past `<main>`'s end
            padding. `relative` is what a screen that fills the region positions itself against
            (`absolute inset-0`) so its own scrollers, not `<main>`, take its height. */}
        <div data-testid="app-ready" className="relative flex flex-1 flex-col gap-4">
          <span data-testid="domain-label-probe" className="sr-only">
            {rarityLabel('Comum', lang)}
          </span>
          {!consentLoaded ? null : gated ? (
            <ConsentGate locale={locale} onLocaleChange={onLocaleChange} onReadAgain={onConsentReallow} />
          ) : activeNavId === 'settings' ? (
            <div data-testid="settings-view" className="mx-auto flex w-full max-w-settings flex-col gap-4">
              <LanguageSection locale={locale} onLocaleChange={onLocaleChange} persistWarning={persistWarning} />
              <WindowSection
                alwaysOnTopMain={alwaysOnTopMain}
                onAlwaysOnTopMainChange={onAlwaysOnTopMainChange}
                persistWarning={alwaysOnTopWarning}
                alwaysOnTopMini={alwaysOnTopMini}
                onAlwaysOnTopMiniChange={onAlwaysOnTopMiniChange}
                miniPersistWarning={alwaysOnTopMiniWarning}
              />
              <GameSection
                restartGameOnExit={restartGameOnExit}
                onRestartGameOnExitChange={onRestartGameOnExitChange}
                persistWarning={restartGameOnExitWarning}
              />
              <ForgeSection
                forgeWritesEnabled={forgeWritesEnabled}
                onForgeWritesEnabledChange={onForgeWritesEnabledChange}
                persistWarning={forgeWritesWarning}
              />
              <MarketSection
                marketQuoteCurrency={marketQuoteCurrency}
                onMarketQuoteCurrencyChange={onMarketQuoteCurrencyChange}
                persistWarning={marketQuoteCurrencyWarning}
              />
              <ConsentSection onRevoke={onConsentRevoke} />
              <DiagnosticsSection onSave={onSaveDiagnostics} result={diagnosticsDumpResult} />
              <UpdatesSection
                status={updateStatus}
                onCheck={() => {
                  void onUpdateCheck();
                }}
                onDownload={onUpdateDownload}
                onInstall={onUpdateInstall}
              />
              <SupportSection />
            </div>
          ) : activeNavId === 'farm' ? (
            <FarmView onOpenOptimizer={openOptimizerTab} />
          ) : activeNavId === 'heroes' ? (
            <HeroesView marketQuoteCurrency={marketQuoteCurrency} />
          ) : activeNavId === 'inventory' ? (
            <InventoryView marketQuoteCurrency={marketQuoteCurrency} />
          ) : activeNavId === 'forge' ? (
            <ForgeView forgeWritesEnabled={forgeWritesEnabled} accountSource={environment?.accountSource ?? null} />
          ) : activeNavId === 'optimizer' ? (
            <OptimizerView />
          ) : activeNavId === 'pvp' ? (
            <PvpView />
          ) : activeNavId === 'skills' ? (
            <SkillsView />
          ) : activeNavId === 'account' ? (
            <AccountView
              marketQuoteCurrency={marketQuoteCurrency}
              onOpenInventory={() => {
                setActiveNavId('inventory');
              }}
            />
          ) : (
            <LiveView onReopenConsent={onConsentReallow} />
          )}
        </div>
      </AppShell>
    </>
  );
}
