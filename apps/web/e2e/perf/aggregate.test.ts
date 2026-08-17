/**
 * Unit tests for MOD-33 aggregation — derived from spec metric definition + P1-harness AC 9.
 */
import { describe, expect, it } from 'vitest'
import type { CommitRecord } from './collect-commits'
import {
  aggregateRepetition,
  aggregateScenario,
  median,
  sliceWindow,
} from './aggregate'

function commit(
  at: number,
  durationMs: number,
  rendered: { key: string; ownerPath: string; tag?: number; selfDurationMs?: number }[],
): CommitRecord {
  return {
    at,
    durationMs,
    rendered: rendered.map((r) => ({
      key: r.key,
      ownerPath: r.ownerPath,
      tag: r.tag ?? 0,
      selfDurationMs: r.selfDurationMs ?? 0,
    })),
  }
}

describe('sliceWindow', () => {
  const commits = [
    commit(100, 1, [{ key: 'A', ownerPath: 'A' }]),
    commit(200, 1, [{ key: 'B', ownerPath: 'B' }]),
    commit(300, 1, [{ key: 'C', ownerPath: 'C' }]),
  ]

  it('returns empty for an empty commit list', () => {
    expect(sliceWindow([], 0, 1000)).toEqual([])
  })

  it('includes a commit exactly on the window start boundary', () => {
    expect(sliceWindow(commits, 100, 250).map((c) => c.at)).toEqual([100, 200])
  })

  it('includes a commit exactly on the window end boundary', () => {
    expect(sliceWindow(commits, 150, 300).map((c) => c.at)).toEqual([200, 300])
  })

  it('excludes a commit just outside the start boundary', () => {
    expect(sliceWindow(commits, 101, 300).map((c) => c.at)).toEqual([200, 300])
  })

  it('excludes a commit just outside the end boundary', () => {
    expect(sliceWindow(commits, 100, 299).map((c) => c.at)).toEqual([100, 200])
  })
})

describe('aggregateRepetition', () => {
  it('sums componentRenders across commits (one component in three commits → 3)', () => {
    const commits = [
      commit(1, 2, [{ key: 'Foo', ownerPath: 'Foo' }]),
      commit(2, 3, [{ key: 'Foo', ownerPath: 'Foo' }]),
      commit(3, 4, [{ key: 'Foo', ownerPath: 'Foo' }]),
    ]
    const m = aggregateRepetition(commits)
    expect(m.commits).toBe(3)
    expect(m.componentRenders).toBe(3)
    expect(m.distinctComponents).toBe(1)
    expect(m.renderTally).toEqual({ Foo: 3 })
    expect(m.totalCommitDurationMs).toBe(9)
    expect(m.maxCommitDurationMs).toBe(4)
  })

  it('groups anonymous components under <anonymous>', () => {
    const commits = [
      commit(1, 1, [
        { key: '<anonymous>', ownerPath: '<anonymous>' },
        { key: '<anonymous>', ownerPath: '<anonymous>' },
      ]),
    ]
    const m = aggregateRepetition(commits)
    expect(m.componentRenders).toBe(2)
    expect(m.renderTally['<anonymous>']).toBe(2)
  })

  it('disambiguates duplicate keys via owner path', () => {
    const commits = [
      commit(1, 1, [
        { key: 'Cell', ownerPath: 'Table>Row>Cell' },
        { key: 'Cell', ownerPath: 'Other>Cell' },
      ]),
    ]
    const m = aggregateRepetition(commits)
    expect(m.componentRenders).toBe(2)
    expect(m.distinctComponents).toBe(2)
    expect(m.renderTally['Table>Row>Cell']).toBe(1)
    expect(m.renderTally['Other>Cell']).toBe(1)
    expect(m.renderTally.Cell).toBeUndefined()
  })

  it('returns zeros for an empty commit list', () => {
    const m = aggregateRepetition([])
    expect(m).toEqual({
      commits: 0,
      componentRenders: 0,
      distinctComponents: 0,
      renderTally: {},
      totalCommitDurationMs: 0,
      maxCommitDurationMs: 0,
    })
  })
})

describe('median', () => {
  it('returns the middle value for an odd count', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the two middle values for an even count', () => {
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })

  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0)
  })
})

describe('aggregateScenario', () => {
  const base = { id: 'P-02', label: 'type attack', selector: 'input[name=attack]' }

  it('marks deterministic when componentRenders is identical across reps', () => {
    const reps = [
      aggregateRepetition([commit(1, 1, [{ key: 'A', ownerPath: 'A' }])]),
      aggregateRepetition([commit(1, 2, [{ key: 'A', ownerPath: 'A' }])]),
      aggregateRepetition([commit(1, 3, [{ key: 'A', ownerPath: 'A' }])]),
    ]
    const s = aggregateScenario(reps, base)
    expect(s.deterministic).toBe(true)
    expect(s.medianComponentRenders).toBe(1)
    expect(s.medianTotalCommitDurationMs).toBe(2)
    expect(s.minTotalCommitDurationMs).toBe(1)
    expect(s.maxTotalCommitDurationMs).toBe(3)
  })

  it('marks non-deterministic when componentRenders varies, retaining the spread', () => {
    const reps = [
      aggregateRepetition([commit(1, 1, [{ key: 'A', ownerPath: 'A' }])]),
      aggregateRepetition([
        commit(1, 1, [
          { key: 'A', ownerPath: 'A' },
          { key: 'B', ownerPath: 'B' },
        ]),
      ]),
    ]
    const s = aggregateScenario(reps, base)
    expect(s.deterministic).toBe(false)
    expect(s.repetitions.map((r) => r.componentRenders)).toEqual([1, 2])
    expect(s.medianComponentRenders).toBe(1.5)
  })

  it('records skipped scenarios without treating them as a zero baseline', () => {
    const s = aggregateScenario([], {
      ...base,
      id: 'P-01',
      skipped: { reason: 'N/A — unreachable' },
    })
    expect(s.skipped?.reason).toContain('unreachable')
    expect(s.deterministic).toBe(false)
    expect(s.repetitions).toEqual([])
  })
})
