import HeroPlanner from '@/features/planner';

/** Keep-alive planner slot — stays mounted while browsing `/phases`. */
export default function PlannerSlot() {
  return <HeroPlanner />;
}
