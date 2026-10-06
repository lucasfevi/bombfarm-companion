import { describe, expect, it } from 'vitest';
import type { DeconstructStartReason } from '@bombfarm/contracts';
import type { DeconstructBlockReason } from '@bombfarm/domain/deconstruct';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import {
  deconstructBlockText,
  deconstructButtonReason,
  deconstructHintText,
  deconstructLabels,
  deconstructReasonText,
  deconstructRefusalText,
  deconstructResultView,
  deconstructStartRefusalText,
  deconstructWarnings,
  essenceCell,
} from './deconstruct-labels';
import { viewItem } from '../../lib/deconstruct/test-items';

const labels = deconstructLabels(en, 'en', 'en');

const BLOCKS: readonly DeconstructBlockReason[] = ['not_burnable', 'equipped', 'locked', 'market', 'has_gems', 'import_cooldown'];

const START_REASONS: readonly DeconstructStartReason[] = [
  'busy',
  'offline',
  'bad_request',
  'not_consented',
  'game_not_running',
  'token_unavailable',
  'writes_disabled',
  'unknown_item',
  'unavailable',
];

const READY = { accountSource: 'server', forgeWritesEnabled: true, burning: false, forgeBusy: false, selected: 3 } as const;

describe('the refusal wording', () => {
  it("gives every block reason the game's own line in both languages", () => {
    expect(deconstructBlockText('equipped', en)).toBe('Unequip this item before burning it.');
    expect(deconstructBlockText('equipped', ptBR)).toBe('Desequipe este item antes de queimá-lo.');
    expect(deconstructBlockText('market', en)).toBe("This item is on the Market and can't be burned.");
    expect(deconstructBlockText('has_gems', ptBR)).toBe('Este item tem gema encaixada e não pode ser queimado.');
    expect(deconstructBlockText('import_cooldown', en)).toBe("This item came from Steam recently and can't be burned yet.");
    expect(deconstructBlockText('not_burnable', en)).toBe("This item can't be burned.");
    expect(deconstructBlockText('not_burnable', ptBR)).toBe('Este item não pode ser queimado.');
    for (const reason of BLOCKS) {
      expect(deconstructBlockText(reason, en)).not.toBe('');
      expect(deconstructBlockText(reason, ptBR)).not.toBe('');
    }
  });

  it('turns a server refusal code into the line for what it means', () => {
    expect(deconstructRefusalText('ITEM_EQUIPPED', en)).toBe(en.deconstructBlockEquipped);
    expect(deconstructRefusalText('ITEM_USER_LOCKED', ptBR)).toBe(ptBR.deconstructBlockLocked);
    expect(deconstructRefusalText('ITEM_LOCKED', en)).toBe(en.deconstructBlockMarket);
    expect(deconstructRefusalText('ITEM_IMPORT_COOLDOWN', en)).toBe(en.deconstructBlockCooldown);
    expect(deconstructRefusalText('ITEM_IMPORT_COOLDOWN', ptBR)).toBe(ptBR.deconstructBlockCooldown);
    expect(deconstructRefusalText('ITEM_NOT_BURNABLE', en)).toBe(en.deconstructBlockNotBurnable);
    expect(deconstructRefusalText('BURN_BATCH_TOO_BIG', en)).toBe('At most 100 items per burn.');
    expect(deconstructRefusalText('BURN_BATCH_TOO_BIG', ptBR)).toBe('Cabem no máximo 100 itens por queima.');
    expect(deconstructRefusalText('NO_SUCH_ITEM', en)).toBe('Item unavailable — refresh and try again.');
  });

  it('prints the code itself for one the client has no wording for', () => {
    expect(deconstructRefusalText('SOMETHING_NEW', en)).toBe('The server refused it with the code SOMETHING_NEW.');
    expect(deconstructRefusalText('SOMETHING_NEW', ptBR)).toContain('SOMETHING_NEW');
  });

  it('words every way main can refuse to start, naming forging for a burn only through the switch label', () => {
    for (const reason of START_REASONS) {
      const text = deconstructStartRefusalText(reason, en);
      expect(text, reason).not.toBe('');
      if (reason !== 'writes_disabled') expect(text.toLowerCase(), reason).not.toContain('forg');
      expect(deconstructStartRefusalText(reason, ptBR), reason).not.toBe('');
    }
  });

  it("points a switched-off writes setting at the Settings switch by its exact label", () => {
    expect(deconstructStartRefusalText('writes_disabled', en)).toContain(en.settingsForgeWritesLabel);
    expect(deconstructStartRefusalText('writes_disabled', ptBR)).toContain(ptBR.settingsForgeWritesLabel);
  });
});

describe('deconstructButtonReason', () => {
  it('is ready with a batch, a server, the switch on and no forge run holding the lock', () => {
    expect(deconstructButtonReason(READY)).toBe('ready');
  });

  it('answers with the first reason that applies, in order', () => {
    const all = { accountSource: 'fixture', forgeWritesEnabled: false, burning: true, forgeBusy: true, selected: 0 } as const;
    expect(deconstructButtonReason(all)).toBe('running');
    expect(deconstructButtonReason({ ...all, burning: false })).toBe('forge');
    expect(deconstructButtonReason({ ...all, burning: false, forgeBusy: false })).toBe('fixture');
    expect(deconstructButtonReason({ ...all, burning: false, forgeBusy: false, accountSource: 'server' })).toBe('switch-off');
    expect(deconstructButtonReason({ ...READY, selected: 0 })).toBe('none');
  });

  it('names the Settings switch by its exact label when the switch is off', () => {
    expect(deconstructReasonText('switch-off', en)).toContain(`"${en.settingsForgeWritesLabel}"`);
    expect(deconstructReasonText('switch-off', ptBR)).toContain(`"${ptBR.settingsForgeWritesLabel}"`);
  });
});

describe('deconstructWarnings', () => {
  const rare = viewItem({ rarity: 3 });
  const forged = viewItem({ upgrade: 4 });

  it('applies each line only when the batch holds what it warns about, with the count', () => {
    const none = deconstructWarnings({ count: 1, essence: 30, forged: 0, rare: 0 }, en, labels);
    expect([none.forged.active, none.rare.active]).toEqual([false, false]);

    const both = deconstructWarnings({ count: 2, essence: 230, forged: 1, rare: 2 }, en, labels);
    expect(both.forged).toEqual({
      active: true,
      text: 'Forged items in the batch: 1. Their forge is lost, and only part of the Essence comes back.',
    });
    expect(both.rare).toEqual({ active: true, text: 'Items of Epic rarity or above in the batch: 2.' });
    expect(rare.rarityIdx).toBeGreaterThanOrEqual(3);
    expect(forged.upgrade).toBeGreaterThan(0);
  });
});

describe('deconstructResultView', () => {
  it('words a burn with the server gain as a signed figure and the balance it left', () => {
    const many = deconstructResultView({ kind: 'burned', burned: 12, gained: 1_234, essence: 5_000 }, en, labels);
    expect(many.tone).toBe('ok');
    expect(many.heading).toBe('Burned 12 items: +1,234 Forge Essence');
    expect(many.lines).toEqual(['Forge Essence now: 5,000']);
    expect(deconstructResultView({ kind: 'burned', burned: 1, gained: 9, essence: 9 }, en, labels).heading).toBe('Burned 1 item: +9 Forge Essence');
    const ptMany = deconstructResultView({ kind: 'burned', burned: 12, gained: 1_234, essence: 5_000 }, ptBR, deconstructLabels(ptBR, 'pt', 'pt-BR'));
    expect(ptMany.heading).toBe('Queimou 12 itens: +1.234 de Essência de Forja');
    expect(ptMany.lines).toEqual(['Essência de Forja agora: 5.000']);
  });

  it('words the import cooldown as a refusal about the item, not as a pause the server asked for', () => {
    const view = deconstructResultView({ kind: 'refused', code: 'ITEM_IMPORT_COOLDOWN' }, en, labels);
    expect(view.tone).toBe('warn');
    expect(view.heading).toBe(en.deconstructResultRefused);
    expect(view.lines).toEqual([en.deconstructBlockCooldown]);
  });

  it('words a refusal as nothing burned, followed by the reason', () => {
    const view = deconstructResultView({ kind: 'refused', code: 'ITEM_HAS_GEMS' }, en, labels);
    expect(view.tone).toBe('warn');
    expect(view.heading).toBe('Nothing was burned: the batch was refused.');
    expect(view.lines).toEqual([en.deconstructBlockGems]);
  });

  it('words a failure honestly: it may or may not have gone through, and the list is refreshing', () => {
    for (const reason of ['cooldown', 'session', 'network', 'unreadable', 'error'] as const) {
      const view = deconstructResultView({ kind: 'failed', reason }, en, labels);
      expect(view.tone).toBe('warn');
      expect(view.lines).toHaveLength(2);
      expect(view.lines[1]).toContain('may or may not');
      expect(view.lines[1]).toContain('refreshing');
    }
  });

  it('words a start that was refused', () => {
    const view = deconstructResultView({ kind: 'start-refused', reason: 'not_consented' }, en, labels);
    expect(view.lines).toEqual([en.deconstructStartNotConsented]);
  });
});

describe('the writes switch', () => {
  it('keeps its label and says in its help that burning items is among what it allows, in both languages', () => {
    expect(en.settingsForgeWritesLabel).toBe('Let the app forge, equip and reset points');
    expect(en.settingsForgeWritesHelp).toContain('burn items');
    expect(ptBR.settingsForgeWritesLabel).toBe('Deixar o app forjar, equipar e redistribuir pontos');
    expect(ptBR.settingsForgeWritesHelp).toContain('queimar itens');
  });
});

describe('the small labels', () => {
  it('prints the essence of a row as the server sent it, and a dash when the row carried none', () => {
    expect(essenceCell(viewItem({ essence_value: 1_500 }), labels)).toBe('1,500');
    expect(essenceCell(viewItem({ essence_value: undefined }), labels)).toBe('—');
  });

  it('words the hints under the batch figures', () => {
    expect(deconstructHintText({ kind: 'cap' }, en, labels)).toBe('At most 100 items per burn.');
    expect(deconstructHintText({ kind: 'overflow', count: 7 }, en, labels)).toBe('7 more did not fit under the limit of 100.');
    expect(deconstructHintText({ kind: 'pruned', count: 1 }, en, labels)).toBe('1 item left your batch because it can no longer be burned.');
    expect(deconstructHintText({ kind: 'pruned', count: 12 }, en, labels)).toBe('12 items left your batch because they can no longer be burned.');
    expect(deconstructHintText({ kind: 'pruned', count: 2 }, ptBR, deconstructLabels(ptBR, 'pt', 'pt-BR'))).toBe(
      '2 itens saíram do seu lote porque não podem mais ser queimados.',
    );
    expect(deconstructHintText({ kind: 'fill-none' }, en, labels)).toBe(en.deconstructHintFillNone);
  });

  it('names the warning rarity from the domain threshold in both languages', () => {
    expect(labels.warnRarity).toBe('Epic');
    expect(deconstructLabels(ptBR, 'pt', 'pt-BR').warnRarity).toBe('Épico');
  });
});
