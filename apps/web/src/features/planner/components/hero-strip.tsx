'use client';

import { useState } from 'react';
import { HiMiniTrash } from 'react-icons/hi2';
import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import {
  usePlannerStore,
  selectHeroName,
  selectHeroBattleAllowed,
  selectAdvisorPipeline,
} from '@/shared/stores';
import { useHeroDraftActions } from '../hooks/use-hero-draft-actions';

import { Button, ConfirmDialog, cn } from '@bombfarm/ui';
import { HeroPickerDialog } from '@/features/roster';
import { HeroStripIdentity } from './hero-strip-identity';
import { HeroStripMetrics } from './hero-strip-metrics';
import { HeroStripUpgrades } from './hero-strip-upgrades';

/**
 * The exact warn border color `importResetWarningClass` uses, isolated here since
 * that recipe constant otherwise bundles surface/padding/typography this strip does not want.
 * Same `border` width as the neutral state — the swap costs no layout.
 */
const heroStripWarnBorderClass = 'border-[color-mix(in_oklch,var(--warn)_45%,var(--line))]';

export function HeroStrip() {
  const { t, lang } = useAppLang();
  const { applyHero, handleDeleteHero } = useHeroDraftActions();

  const heroes = usePlannerStore((state) => state.heroes);
  const heroId = usePlannerStore((state) => state.activeHeroId);
  const heroName = usePlannerStore(selectHeroName);
  const heroBattleAllowed = usePlannerStore(selectHeroBattleAllowed);
  const resetAdvice = usePlannerStore((state) => selectAdvisorPipeline(state).resetAdvice);

  const onSelectHero = applyHero;
  const onDelete = handleDeleteHero;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const showResetAdvice = resetAdvice.recommend && heroBattleAllowed;

  return (
    <>
      <section
        className={cn(
          'relative mb-2.5 border bg-surface',
          showResetAdvice ? heroStripWarnBorderClass : 'border-line',
        )}
        role="region"
        aria-label={t.heroStripLabel}
      >
        <div className="grid grid-cols-1 items-stretch xl:grid-cols-[minmax(0,1.05fr)_auto_auto_auto]">
          <HeroStripIdentity onOpenPicker={() => setPickerOpen(true)} />

          <HeroStripMetrics />

          <HeroStripUpgrades />

          <div className="flex items-center justify-center px-1.5 py-1">
            <Button
              type="button"
              variant="icon"
              disabled={!heroId}
              onClick={() => setDeleteOpen(true)}
              aria-label={t.deleteHeroAria}
              title={t.del}
            >
              <HiMiniTrash size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      <HeroPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        heroes={heroes}
        heroId={heroId}
        lang={lang}
        t={t}
        formatNumber={formatNumber}
        onSelectHero={onSelectHero}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.confirmDeleteTitle}
        description={sub(t.confirmDelete, { name: heroName })}
        confirmLabel={t.del}
        cancelLabel={t.importCancel}
        onConfirm={onDelete}
      />
    </>
  );
}
