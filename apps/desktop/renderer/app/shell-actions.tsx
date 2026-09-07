/**
 * The top bar's right-hand cluster, in the two shapes it has room for.
 *
 * At `full` density every action is its own control beside the tabs. Below that the cluster is one
 * overflow button: the actions are secondary — nothing here is a destination — so they are what
 * gives way first, and the tabs keep their words down to a much narrower window than they
 * otherwise could. The cluster never renders both shapes at once, so a control has exactly one
 * place in the document at any width.
 */
'use client';

import type { AppLocale } from '@bombfarm/contracts';
import { Button, Icon, Menu, SegmentedToggle, buttonRecipe, type ShellDensity } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';
import { CoffeeIconLink, CoffeeMenuItem } from './coffee-link';
import { ReferralChip, ReferralMenuItem } from './referral-link';

// Matches the shipped Settings language `Select` (the primitive-control rule) — same two locales,
// same `onLocaleChange`, kept in sync only because both read/write the one `locale` state in
// `HomePage`.
const LOCALE_OPTIONS: ReadonlyArray<{ id: AppLocale; label: string }> = [
  { id: 'pt-BR', label: 'PT' },
  { id: 'en', label: 'EN' },
];

function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

function openMiniLive(): void {
  const bridge = getBridge();
  if (!bridge) return;
  void bridge.invoke('miniLive:open');
}

export function OpenMiniButton() {
  const t = useCopy();

  return (
    <Button
      type="button"
      variant="text"
      data-testid="open-mini"
      onClick={openMiniLive}
      className="inline-flex items-center gap-1.5"
    >
      <Icon name="window" size="sm" />
      {t.miniLiveOpenLabel}
    </Button>
  );
}

function OpenMiniMenuItem() {
  const t = useCopy();

  return (
    <Menu.Item onClick={openMiniLive} data-testid="shell-overflow-open-mini">
      <Icon name="window" size="sm" />
      {t.miniLiveOpenLabel}
    </Menu.Item>
  );
}

function isLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'pt-BR';
}

function ShellOverflowMenu({
  granted,
  locale,
  onLocaleChange,
}: {
  granted: boolean;
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
}) {
  const t = useCopy();

  return (
    <Menu.Root>
      <Menu.Trigger
        data-testid="shell-overflow"
        aria-label={t.shellMoreActionsLabel}
        className={buttonRecipe({ variant: 'default' })}
      >
        <Icon name="ellipsis-horizontal" size="sm" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6}>
          <Menu.Popup data-testid="shell-overflow-menu">
            {granted ? <OpenMiniMenuItem /> : null}
            <ReferralMenuItem />
            <CoffeeMenuItem />
            <Menu.Separator />
            <Menu.Group>
              <Menu.GroupLabel>{t.consentGateLanguageLabel}</Menu.GroupLabel>
              <Menu.RadioGroup
                value={locale}
                onValueChange={(next) => {
                  if (isLocale(next)) onLocaleChange(next);
                }}
              >
                <Menu.RadioItem value="pt-BR" data-testid="shell-overflow-language-pt">
                  <Menu.RadioItemIndicator>
                    <Icon name="check" size="xs" />
                  </Menu.RadioItemIndicator>
                  {t.settingsLanguageOptionPortuguese}
                </Menu.RadioItem>
                <Menu.RadioItem value="en" data-testid="shell-overflow-language-en">
                  <Menu.RadioItemIndicator>
                    <Icon name="check" size="xs" />
                  </Menu.RadioItemIndicator>
                  {t.settingsLanguageOptionEnglish}
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export interface ShellActionsProps {
  density: ShellDensity;
  /** The mini-window opener reads the account, so it waits for consent the way the tabs do. */
  granted: boolean;
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
}

export function ShellActions({ density, granted, locale, onLocaleChange }: ShellActionsProps) {
  const t = useCopy();

  if (density !== 'full') {
    return <ShellOverflowMenu granted={granted} locale={locale} onLocaleChange={onLocaleChange} />;
  }

  return (
    <div className="flex items-center gap-3">
      {granted ? <OpenMiniButton /> : null}
      {/* Left of the language toggle, and unconditional — unlike the mini-window button above
          them: the gate screen is where a first run spends its time, and neither of these reads
          the account or touches the game. */}
      <ReferralChip />
      <CoffeeIconLink />
      <SegmentedToggle
        options={LOCALE_OPTIONS}
        value={locale}
        onChange={(id) => {
          if (isLocale(id)) onLocaleChange(id);
        }}
        ariaLabel={t.consentGateLanguageLabel}
      />
    </div>
  );
}
