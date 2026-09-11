import {
  teamPlanPageEn,
  teamPlanPagePtBR,
  type TeamPlanHostCopy,
  type TeamPlanPageCopy,
} from '@bombfarm/team-plan/copy';

type PageHostCopy = Pick<
  TeamPlanHostCopy,
  | 'teamPlanEmptyNoRosterTitle'
  | 'teamPlanEmptyNoRosterBody'
  | 'teamPlanEmptyNoInventoryTitle'
  | 'teamPlanEmptyNoInventoryBody'
  | 'teamPlanEmptyAllLeaveAloneTitle'
  | 'teamPlanEmptyAllLeaveAloneBody'
  | 'teamPlanBlockedBody'
> & { teamPlanImportCta: string };

const hostEn: PageHostCopy = {
  teamPlanEmptyNoRosterTitle: 'Import heroes first',
  teamPlanEmptyNoRosterBody:
    'Export your save in Bomb Farm, then use Import in the top bar to load your roster and item inventory.',
  teamPlanEmptyNoInventoryTitle: 'No item inventory yet',
  teamPlanEmptyNoInventoryBody:
    'Re-import your save so the planner can read every item you own, not only what is equipped.',
  teamPlanEmptyAllLeaveAloneTitle: 'Nothing in scope',
  teamPlanEmptyAllLeaveAloneBody:
    'Set at least one hero to Optimize before running a plan.',
  teamPlanImportCta: 'Import save',
  teamPlanBlockedBody:
    'Re-export your save so these heroes include a birth roll: {heroes}.',
};

const hostPt: PageHostCopy = {
  teamPlanEmptyNoRosterTitle: 'Importe heróis primeiro',
  teamPlanEmptyNoRosterBody:
    'Exporte o save no Bomb Farm e use Importar na barra superior para carregar o roster e o inventário de itens.',
  teamPlanEmptyNoInventoryTitle: 'Sem inventário de itens',
  teamPlanEmptyNoInventoryBody:
    'Reimporte o save para o planner ler todos os itens que você tem, não só o que está equipado.',
  teamPlanEmptyAllLeaveAloneTitle: 'Nada no escopo',
  teamPlanEmptyAllLeaveAloneBody:
    'Marque pelo menos um herói como Otimizar antes de rodar um plano.',
  teamPlanImportCta: 'Importar save',
  teamPlanBlockedBody:
    'Reexporte o save para estes heróis incluírem o roll de nascimento: {heroes}.',
};

export const en: TeamPlanPageCopy & PageHostCopy = { ...teamPlanPageEn, ...hostEn };
export const pt: TeamPlanPageCopy & PageHostCopy = { ...teamPlanPagePtBR, ...hostPt };
