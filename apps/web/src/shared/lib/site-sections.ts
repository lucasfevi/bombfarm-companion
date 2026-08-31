export type SiteSection = 'planner' | 'farm' | 'teamPlan' | 'inventory' | 'account' | 'download';

/**
 * Every top-level route, in order.
 *
 * This is what the shell uses to decide whether a path renders `children` or the kept-alive
 * planner slot, so a section missing here is a route that renders nothing — which is how
 * `/download` first shipped unreachable.
 */
export const SITE_SECTIONS: readonly SiteSection[] = [
  'planner',
  'farm',
  'teamPlan',
  'inventory',
  'account',
  'download',
];

/**
 * The sections that appear as nav tabs. `download` is deliberately absent: it is reached from the
 * primary button beside Import, which is a call to action rather than a place in the planner.
 */
export const NAV_SECTIONS: readonly SiteSection[] = SITE_SECTIONS.filter(
  (section) => section !== 'download',
);

export const SITE_SECTION_HREF: Record<SiteSection, string> = {
  planner: '/',
  farm: '/farm',
  teamPlan: '/team-plan',
  inventory: '/inventory',
  account: '/account',
  download: '/download',
};

/**
 * The i18n key each label reads from, as a literal rather than an import: `shared/lib` may not
 * reach `shared/i18n`, and the consumers that index `Strings` with these already can.
 */
export const SITE_SECTION_LABEL_KEY = {
  planner: 'navPlanner',
  farm: 'navPhases',
  teamPlan: 'navTeamPlan',
  inventory: 'navInventory',
  account: 'navAccount',
  download: 'downloadNavLabel',
} as const satisfies Record<SiteSection, string>;

/** `/` matches only itself; every other section owns its prefix. */
export function isSiteSectionActive(section: SiteSection, pathname: string): boolean {
  if (section === 'planner') return pathname === '/';
  return pathname.startsWith(SITE_SECTION_HREF[section]);
}
