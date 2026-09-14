import Link from 'next/link';
import { sub, type Strings } from '@/shared/i18n';

export function OptimizerPlanFooter({ moves, resets, t }: { moves: number; resets: number; t: Strings }) {
  const counts = [
    moves > 0 ? sub(t.homeCardOptimizerCountMoves, { count: moves }) : null,
    resets > 0 ? sub(t.homeCardOptimizerCountResets, { count: resets }) : null,
  ].filter((segment): segment is string => segment !== null);
  const lead = counts.length === 0 ? '' : `${counts.join(' · ')} · `;

  return (
    <>
      {lead}
      <Link className="underline underline-offset-2" href="/optimizer">
        {t.homeCardOptimizerSeeFullPlan}
      </Link>
    </>
  );
}
