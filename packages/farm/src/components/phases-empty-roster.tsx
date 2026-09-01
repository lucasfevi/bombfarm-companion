'use client';

import type { ReactNode } from 'react';
import { Panel, phasesBoardRosterSpanClass } from '@bombfarm/ui';
import { useFarmCopy } from './farm-copy-context';

/**
 * `action` is where a host puts the link to its own roster-editing screen. It is a slot rather than
 * an `href`, because routing is the host's (this package cannot depend on a router), and it is
 * optional because a host with no such screen is better served by the message alone than by a link
 * that goes nowhere.
 */
export function PhasesEmptyRoster({ action }: { action?: ReactNode }) {
  const { t } = useFarmCopy();

  return (
    <Panel className={phasesBoardRosterSpanClass}>
      <p className="m-0 text-sm text-muted">{t.phasesNoHeroes}</p>
      {action ? (
        <p className="mt-2 mb-0 text-sm">
          {action}
          {' — '}
          {t.phasesNoHeroesLink}
        </p>
      ) : null}
    </Panel>
  );
}
