/**
 * The top bar's right-hand cluster, in the two shapes it has room for.
 *
 * The cluster keeps every action as its own control until the bar is at its narrowest, past the
 * width where the tabs have already dropped to glyphs: a tab loses a word standing in for a glyph
 * the player learns once, while an action behind a menu costs a click every time it is used. Only
 * then does the cluster become one overflow button. It never renders both shapes at once, so a
 * control has exactly one place in the document at any width.
 */
'use client';

import type { AppLocale } from '@bombfarm/contracts';
import {
  Button,
  Icon,
  Menu,
  SegmentedToggle,
  Tooltip,
  buttonRecipe,
  cn,
  type IconName,
  type ShellDensity,
} from '@bombfarm/ui';
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

function OpenMiniMenuItem() {
  const t = useCopy();

  return (
    <Menu.Item onClick={openMiniLive} data-testid="shell-overflow-open-mini">
      <Icon name="window" size="sm" />
      {t.miniLiveOpenLabel}
    </Menu.Item>
  );
}

/**
 * The footprint of an icon-only control in the bar: the 30px square the support link's pill
 * measures (a 16px glyph, 6px of padding each way and the 1px border), with the glyph centred in
 * it. A default `Button` pads 10px across and 6px down, which draws a rectangle wider than tall
 * and leaves a glyph off-centre in it.
 */
export const SHELL_ICON_BUTTON_CLASS = 'inline-grid size-[30px] place-items-center px-0 py-0';

function ShellIconButton({
  icon,
  label,
  testId,
  onClick,
  active = false,
}: {
  icon: IconName;
  label: string;
  testId: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Button
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              data-testid={testId}
              data-active={active ? 'true' : undefined}
              onClick={onClick}
              className={cn(SHELL_ICON_BUTTON_CLASS, active && 'border-accent', active && 'text-accent')}
            />
          }
        >
          <Icon name={icon} size="sm" />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0">{label}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
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

function SettingsGear({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  const t = useCopy();

  return (
    <ShellIconButton
      icon="cog"
      label={t.settingsNavLabel}
      testId="shell-settings"
      onClick={onOpen}
      active={active}
    />
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
  /** The Settings screen is on show, so the gear carries the current-page treatment. */
  settingsActive: boolean;
  onOpenSettings: () => void;
}

export function ShellActions({
  density,
  granted,
  locale,
  onLocaleChange,
  settingsActive,
  onOpenSettings,
}: ShellActionsProps) {
  const t = useCopy();

  if (density === 'actions-collapsed') {
    return (
      <div className="flex items-center gap-3">
        <ShellOverflowMenu granted={granted} locale={locale} onLocaleChange={onLocaleChange} />
        {granted ? <SettingsGear active={settingsActive} onOpen={onOpenSettings} /> : null}
      </div>
    );
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
      {granted ? <SettingsGear active={settingsActive} onOpen={onOpenSettings} /> : null}
    </div>
  );
}
