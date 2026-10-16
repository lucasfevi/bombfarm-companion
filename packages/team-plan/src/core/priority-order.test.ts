import { describe, expect, it } from 'vitest';
import { movePriorityBefore, resolvePriorityOrder, shiftPriority } from './priority-order';

const heroes = [{ id: 'a' }, { id: 'b' }, { id: 'c', battleAllowed: false }, { id: 'd' }];

describe('resolvePriorityOrder', () => {
  it('puts the stored order first and the other Optimize heroes after it in roster order', () => {
    expect(resolvePriorityOrder(heroes, {}, ['d', 'b'])).toEqual(['d', 'b', 'a']);
  });

  it('leaves out heroes that are not in Optimize, by choice or by default', () => {
    expect(resolvePriorityOrder(heroes, { a: 'leaveAlone', c: 'donate' }, ['c', 'a', 'd'])).toEqual(['d', 'b']);
  });

  it('follows the roster when nothing has been ordered yet', () => {
    expect(resolvePriorityOrder(heroes, { c: 'optimize' }, [])).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('movePriorityBefore', () => {
  it('takes the place of the hero it is dropped on', () => {
    expect(movePriorityBefore(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
    expect(movePriorityBefore(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'a', 'c', 'd']);
  });

  it('goes last when dropped on no hero, and joins the order when it was not in it', () => {
    expect(movePriorityBefore(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
    expect(movePriorityBefore(['a', 'b'], 'z', 'b')).toEqual(['a', 'z', 'b']);
  });
});

describe('shiftPriority', () => {
  it('moves one place and stops at either end', () => {
    expect(shiftPriority(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(shiftPriority(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(shiftPriority(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(shiftPriority(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });
});
