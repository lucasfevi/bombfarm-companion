import { describe, expect, it } from 'vitest';

let flag = false;

describe('the domain project yields to the event loop between tests', () => {
  it('schedules a macrotask', () => {
    setImmediate(() => {
      flag = true;
    });
  });

  it('the macrotask has run by the next test', () => {
    expect(
      flag,
      'the per-test yield in tests/helpers/yield-between-tests.ts is not active (setupFiles in ' +
        'packages/domain/vitest.config.ts), so a synchronous file past 60 s in total fails the run ' +
        'with every test passing',
    ).toBe(true);
  });
});
