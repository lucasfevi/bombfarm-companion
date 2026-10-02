import { describe, expect, it } from 'vitest';
import { COLLECTION_AXES } from '@bombfarm/contracts';
import { itemSlot, setName, slotLabel } from '@bombfarm/domain/game-labels';
import { buildCollectionBoard } from '@bombfarm/domain/model';
import { collectionsSnapshotFixture, defined } from '../../lib/collections/collections-test-fixture';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import {
  axisLabel,
  axisTipLines,
  axisTileLabel,
  countOf,
  pieceCellLabel,
  pieceSlotLabel,
  pieceState,
  readyBooksLabel,
  summaryLine,
} from './collections-labels';

const snapshot = collectionsSnapshotFixture();
const board = buildCollectionBoard(snapshot, [{ defId: 'gold_elmo', rarity: 3, free: true }]);
const axisRow = (axis: string) => defined(board.axes.find((row) => row.axis === axis), axis);

describe('axisLabel', () => {
  it('names the ten axes in English in the game’s panel order', () => {
    expect(COLLECTION_AXES.map((axis) => axisLabel(axis, en))).toEqual([
      'Damage',
      'Critical damage',
      'Critical chance',
      'Cooldown',
      'Cage and boss',
      'Energy',
      'Gold',
      'Experience',
      'Luck',
      'Forge',
    ]);
  });

  it('names them in Portuguese with the game’s own words', () => {
    expect(COLLECTION_AXES.map((axis) => axisLabel(axis, ptBR))).toEqual([
      'Dano',
      'Dano crítico',
      'Chance de crítico',
      'Recarga',
      'Jaula e chefe',
      'Energia',
      'Ouro',
      'Experiência',
      'Sorte',
      'Forja',
    ]);
  });
});

describe('axisTipLines', () => {
  it('says what the axis affects, how many books grant it, and what all of them complete add up to', () => {
    const lines = axisTipLines(axisRow('gold'), en, 'en');
    expect(lines[0]).toBe('Raises the gold every phase pays.');
    expect(lines[1]).toBe('Books that grant it: 3.');
    expect(lines[2]).toBe('Every one of them complete adds up to +92%, but the cap stops it at 60%.');
  });

  it('names the cap that stops it only when the books’ maximum runs past it', () => {
    const damage = axisTipLines(axisRow('damage'), en, 'en');
    expect(damage[2]).toBe('Every one of them complete adds up to +71.5%, but the cap stops it at 30%.');
    const underCap = { ...axisRow('forge'), maxRaw: 20, cap: 45 };
    expect(axisTipLines(underCap, en, 'en')[2]).toBe('Every one of them complete adds up to +20%.');
  });

  it('keeps the two limits the game applies after the bonus in the crit chance and cooldown tips', () => {
    expect(axisTipLines(axisRow('critChance'), en, 'en')[0]).toContain('100%');
    expect(axisTipLines(axisRow('cooldown'), en, 'en')[0]).toContain('80%');
  });

  it('is written in Portuguese with a decimal comma', () => {
    const lines = axisTipLines(axisRow('gold'), ptBR, 'pt-BR');
    expect(lines[0]).toBe('Aumenta o ouro pago por cada fase.');
    expect(lines[2]).toBe('Todos eles completos somam +92%, mas o teto limita em 60%.');
  });

  it('carries a tip for every axis', () => {
    for (const row of board.axes) expect(axisTipLines(row, en, 'en')[0]?.length).toBeGreaterThan(10);
  });
});

describe('summaryLine', () => {
  it('partitions the books by the progress filter’s own words and leaves the bag out when nothing is ready', () => {
    const line = summaryLine({ ...board.summary, readyInBag: 0 }, en, 'en');
    const [inProgress, complete, untouched] = [...line.matchAll(/(\d+) (?:in progress|complete|not started)/g)].map((match) => Number(match[1]));
    expect(line).toMatch(/^\d+ in progress · 2 complete · \d+ not started · \d+ of 1,440 pieces sacrificed$/);
    expect((inProgress ?? 0) + (complete ?? 0) + (untouched ?? 0)).toBe(30);
  });

  it('counts the books as the filter returns them: in progress leaves complete books out', () => {
    const summary = { ...board.summary, booksStarted: 10, booksComplete: 2, booksTotal: 30, readyInBag: 0 };
    expect(summaryLine(summary, en, 'en')).toContain('8 in progress · 2 complete · 20 not started');
    expect(summaryLine(summary, ptBR, 'pt-BR')).toContain('8 em andamento · 2 completos · 20 não iniciados');
  });

  it('adds the bag when something in it is ready', () => {
    expect(summaryLine(board.summary, en, 'en')).toMatch(/ · 1 ready in bag$/);
    expect(summaryLine(board.summary, ptBR, 'pt-BR')).toMatch(/ · 1 prontas na mochila$/);
  });
});

describe('axisTileLabel', () => {
  it('names the axis, its figure and its cap for a screen reader', () => {
    expect(axisTileLabel(axisRow('gold'), en, 'en')).toBe('Gold, +7.74%, cap 60%');
    expect(axisTileLabel(axisRow('gold'), ptBR, 'pt-BR')).toBe('Ouro, +7,74%, teto 60%');
  });
});

describe('readyBooksLabel', () => {
  it('says the number counts books, in the singular and the plural, in both languages', () => {
    expect(readyBooksLabel(1, en, 'en')).toBe('1 book');
    expect(readyBooksLabel(3, en, 'en')).toBe('3 books');
    expect(readyBooksLabel(1, ptBR, 'pt-BR')).toBe('1 livro');
    expect(readyBooksLabel(3, ptBR, 'pt-BR')).toBe('3 livros');
  });
});

describe('countOf', () => {
  it('prints a count against what it can reach', () => {
    expect(countOf(5, 8, en, 'en')).toBe('5/8');
    expect(countOf(1_000, 1_440, en, 'en')).toBe('1,000/1,440');
  });
});

describe('piece slots', () => {
  it('puts every piece of the fixture under the slot name the catalog gives its definition', () => {
    for (const piece of snapshot.pieces) {
      const slot = itemSlot({ defId: piece.defId });
      expect(slot, piece.defId).not.toBeNull();
      expect(pieceSlotLabel(piece.slot, 'en'), piece.defId).toBe(slotLabel(slot ?? 'arma', 'en'));
    }
  });

  it('labels a slot in either language and falls back to the number for an unknown one', () => {
    expect(pieceSlotLabel(1, 'en')).toBe('Helm');
    expect(pieceSlotLabel(1, 'pt')).toBe('Elmo');
    expect(pieceSlotLabel(9, 'en')).toBe('9');
  });

  it('has a localised name for every book of the fixture, rather than the raw code', () => {
    for (const set of snapshot.sets) {
      expect(setName(set.code, 'en'), set.code).not.toBe(set.code);
      expect(setName(set.code, 'pt'), set.code).not.toBe(set.code);
    }
  });
});

describe('pieceState and pieceCellLabel', () => {
  const gold = defined(board.sets.find((set) => set.code === 'gold'), 'the gold book');
  const helmet = defined(gold.pieces[1], 'the gold helmet');

  it('puts a sacrificed piece before a ready one, and says missing for the rest', () => {
    expect(pieceState(helmet, 0)).toBe('sacrificed');
    expect(pieceState(helmet, 3)).toBe('ready');
    expect(pieceState(helmet, 5)).toBe('missing');
    expect(pieceState({ ...helmet, pending: [false, false, false, false, true, false] }, 4)).toBe('pending');
  });

  it('writes the piece, its rarity and its state into one name', () => {
    expect(pieceCellLabel(helmet, 0, en, 'en')).toBe('Gold Helm, Common — sacrificed');
    expect(pieceCellLabel(helmet, 3, ptBR, 'pt')).toBe('Ouro Elmo, Épico — pronta na mochila');
  });
});
