import { describe, expect, it } from 'vitest';
import { selectNightlyReleasesToPrune } from './nightly-retention.mjs';

const nightly = (tag, createdAt) => ({ tag, createdAt });

describe('selectNightlyReleasesToPrune', () => {
  it('returns an empty list when fewer than keep releases exist', () => {
    const releases = [
      nightly('desktop-v0.0.0-nightly.20250801.aaaaaaa', '2025-08-01T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250802.bbbbbbb', '2025-08-02T00:00:00Z'),
    ];

    expect(selectNightlyReleasesToPrune(releases, 7)).toEqual([]);
  });

  it('returns an empty list when exactly keep releases exist', () => {
    const releases = Array.from({ length: 7 }, (_, index) =>
      nightly(
        `desktop-v0.0.0-nightly.2025080${index + 1}.sha${index}`,
        `2025-08-0${index + 1}T00:00:00Z`,
      ),
    );

    expect(selectNightlyReleasesToPrune(releases, 7)).toEqual([]);
  });

  it('returns the oldest tags beyond the retention window', () => {
    const releases = [
      nightly('desktop-v0.0.0-nightly.20250801.old0001', '2025-08-01T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250802.old0002', '2025-08-02T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250803.old0003', '2025-08-03T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250804.keep0001', '2025-08-04T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250805.keep0002', '2025-08-05T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250806.keep0003', '2025-08-06T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250807.keep0004', '2025-08-07T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250808.keep0005', '2025-08-08T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250809.keep0006', '2025-08-09T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250810.keep0007', '2025-08-10T00:00:00Z'),
    ];

    expect(selectNightlyReleasesToPrune(releases, 7)).toEqual([
      'desktop-v0.0.0-nightly.20250803.old0003',
      'desktop-v0.0.0-nightly.20250802.old0002',
      'desktop-v0.0.0-nightly.20250801.old0001',
    ]);
  });

  it('never selects beta or stable desktop releases', () => {
    const releases = [
      nightly('desktop-v0.0.0-nightly.20250801.aaaaaaa', '2025-08-01T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250802.bbbbbbb', '2025-08-02T00:00:00Z'),
      { tag: 'desktop-v1.0.0-beta.42', createdAt: '2025-07-01T00:00:00Z' },
      { tag: 'desktop-v1.0.0', createdAt: '2025-06-01T00:00:00Z' },
      nightly('desktop-v0.0.0-nightly.20250803.ccccccc', '2025-08-03T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250804.ddddddd', '2025-08-04T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250805.eeeeeee', '2025-08-05T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250806.fffffff', '2025-08-06T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250807.1111111', '2025-08-07T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250808.2222222', '2025-08-08T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250809.3333333', '2025-08-09T00:00:00Z'),
    ];

    expect(selectNightlyReleasesToPrune(releases, 7)).toEqual([
      'desktop-v0.0.0-nightly.20250802.bbbbbbb',
      'desktop-v0.0.0-nightly.20250801.aaaaaaa',
    ]);
  });

  it('ignores nightly-shaped tags that are not nightly prereleases', () => {
    const releases = [
      { tag: 'desktop-v1.0.0-nightly', createdAt: '2025-01-01T00:00:00Z' },
      nightly('desktop-v0.0.0-nightly.20250801.aaaaaaa', '2025-08-01T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250802.bbbbbbb', '2025-08-02T00:00:00Z'),
    ];

    expect(selectNightlyReleasesToPrune(releases, 1)).toEqual([
      'desktop-v0.0.0-nightly.20250801.aaaaaaa',
    ]);
  });

  it('handles unsorted input by createdAt', () => {
    const releases = [
      nightly('desktop-v0.0.0-nightly.20250803.newest', '2025-08-03T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250801.oldest', '2025-08-01T00:00:00Z'),
      nightly('desktop-v0.0.0-nightly.20250802.middle', '2025-08-02T00:00:00Z'),
    ];

    expect(selectNightlyReleasesToPrune(releases, 1)).toEqual([
      'desktop-v0.0.0-nightly.20250802.middle',
      'desktop-v0.0.0-nightly.20250801.oldest',
    ]);
  });
});
