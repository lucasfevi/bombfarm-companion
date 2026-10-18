'use client';

/**
 * The Progression tab's two pages behind one switch: the skill tree and the collections, the two
 * permanent account-wide bonus screens. A switch of tabs, as on the Forge tab, so it stays apart
 * from the nav buttons of the same names. The shell owns which page is open.
 */
import { Tabs } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { isProgressionPageId, type ProgressionPageId } from '../../lib/progression/progression-page-store';
import { CollectionsView } from '../collections/collections-view';
import { SkillsView } from '../skills/skills-view';

export function ProgressionPage({
  page,
  onPageChange,
}: {
  page: ProgressionPageId;
  onPageChange: (page: ProgressionPageId) => void;
}) {
  const t = useCopy();

  return (
    <div data-testid="progression-page" data-page={page} className="flex flex-1 flex-col gap-3">
      <div className="shrink-0" aria-label={t.progressionSwitchLabel} role="group">
        <Tabs.Root
          value={page}
          onValueChange={(next) => {
            if (isProgressionPageId(next)) onPageChange(next);
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="skills">{t.skillsNavLabel}</Tabs.Tab>
            <Tabs.Tab value="collections">{t.collectionsNavLabel}</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      </div>
      {/* The Skill Tree fills whatever box it sits in with `absolute inset-0`, which it used to
          get from the shell's own region. Under the switch it would still resolve against that
          region, cover the switch and draw its panel title across the tab. This box is what it
          fills now: the room below the switch, and nothing above it. */}
      <div data-testid="progression-body" className="relative flex min-h-0 flex-1 flex-col">
        {page === 'skills' ? <SkillsView /> : <CollectionsView />}
      </div>
    </div>
  );
}
