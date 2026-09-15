import { describe, expect, it } from 'vitest';
import * as viaPackageSpecifier from '@bombfarm/domain/farm-rate';
import * as viaDomainSource from '../../../domain/src/farm-rate';

describe('package wiring', () => {
  it('exposes @bombfarm/domain to code inside this package', () => {
    expect(typeof viaPackageSpecifier.computeFarmRates).toBe('function');
  });

  it('resolves @bombfarm/domain to its source, not to its build output', () => {
    expect(viaPackageSpecifier).toBe(viaDomainSource);
  });
});
