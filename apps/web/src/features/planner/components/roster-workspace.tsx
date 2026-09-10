'use client';

import { useCallback, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { RosterCards, RosterRail, RosterToolbar } from '@bombfarm/hero/components';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { colClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { useRosterView } from '../hooks/use-roster-view';

/**
 * The roster around the planner: a rail of heroes beside the build you are editing, or a board of
 * cards over it.
 *
 * Both shapes and the toolbar that governs them are `@bombfarm/hero`'s, drawn from the same source
 * as the desktop app's Heroes screen — so a player who has learned to sort a roster in one has
 * learned the other, and a change to either arrives in both.
 *
 * The rail is the picker dialog's WIDE counterpart, not its replacement. Below 1100px there is no
 * room for a 19rem column beside a planner tab, so it is not drawn and the hero strip's own
 * "Switch hero" dialog remains the way to choose — the same threshold, and the same fallback, the
 * desktop screen uses.
 *
 * The strip stays OUTSIDE the rail's column and keeps the whole width. It is a four-cell dashboard
 * laid out at the `xl` breakpoint, which is a question about the WINDOW; a 19rem rail beside it
 * takes 314px the breakpoint has already been told the strip has, so its identity cell fell to
 * 188px and clipped six of its own elements. The rail's counterpart is the tab stage below it —
 * the hero DETAIL, which is what the desktop's own rail sits beside — and the strip spans both
 * columns above it, about the hero the rail just picked.
 *
 * The board takes the planner's place entirely rather than sitting above it, because that is what
 * it is for: every hero's roll, pool and gear at once needs the whole width, and the strip is one
 * hero's dashboard, which is the question the board is not answering.
 */
export function RosterWorkspace({ strip, children }: { strip: ReactNode; children: ReactNode }) {
  const { t, lang } = useAppLang();
  const view = useRosterView();
  const statLabel = useCallback((key: SheetKey) => t.statFull[key], [t]);

  if (view.rows.length === 0) {
    return (
      <>
        {strip}
        {children}
      </>
    );
  }

  return (
    <div className={colClass}>
      <RosterToolbar
        rows={view.rows}
        sort={view.sort}
        filter={view.filter}
        viewMode={view.viewMode}
        actions={view.actions}
        t={t}
        lang={lang}
      />
      {/* One presentation at a time, cross-faded: `mode="wait"` lets the outgoing one finish
          before the incoming one lays out, which is what keeps a board of twenty-two cards from
          measuring itself against a planner that is still on screen. `reducedMotion="user"` turns
          the whole thing off for a reader who asked for that. */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait" initial={false}>
          {view.viewMode === 'cards' ? (
            <motion.div
              key="cards"
              className="min-w-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <RosterCards
                rows={view.shownRows}
                selectedId={view.selectedId}
                onSelectHeroId={view.onSelectHeroId}
                statLabel={statLabel}
                t={t}
                lang={lang}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="grid min-w-0 grid-cols-1 gap-2.5 min-[1100px]:grid-cols-[19rem_minmax(0,1fr)]"
            >
              {/* Both columns, so the strip is measured against the window the way its own
                  breakpoint expects rather than against the column beside the rail. */}
              <div className="min-w-0 min-[1100px]:col-span-2">{strip}</div>
              <div className="min-w-0 max-[1099px]:hidden">
                <RosterRail
                  rows={view.shownRows}
                  selectedId={view.selectedId}
                  onSelectHeroId={view.onSelectHeroId}
                  t={t}
                  lang={lang}
                />
              </div>
              <div className="min-w-0">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
