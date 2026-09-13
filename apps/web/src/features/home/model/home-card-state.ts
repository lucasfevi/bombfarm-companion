import type { SiteSection } from '@/shared/lib/site-sections';

export type HomeCardState =
  | 'needs'
  | 'ready'
  | 'skeleton'
  | 'recalculating'
  | 'plan'
  | 'belowFloor'
  | 'blocked'
  | 'error';

export type HomeCardSection = Exclude<SiteSection, 'home'>;
