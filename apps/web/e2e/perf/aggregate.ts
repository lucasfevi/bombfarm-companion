/**
 * Pure aggregation for the render-perf metric definition.
 * Window slicing, tallies, medians, determinism — unit-tested without a browser.
 */
import type { CommitRecord } from './collect-commits'

export interface RepetitionMetrics {
  commits: number
  /** THE committed-component count. Sum across commits in the window. */
  componentRenders: number
  distinctComponents: number
  /** componentKey → render count, descending by count then key. */
  renderTally: Record<string, number>
  totalCommitDurationMs: number
  maxCommitDurationMs: number
}

export interface ScenarioMetrics {
  id: string
  label: string
  selector: string
  repetitions: RepetitionMetrics[]
  medianComponentRenders: number
  medianTotalCommitDurationMs: number
  minTotalCommitDurationMs: number
  maxTotalCommitDurationMs: number
  /** false ⇒ excluded from the determinism gate; spread retained on repetitions. */
  deterministic: boolean
  skipped?: { reason: string }
}

/**
 * Inclusive window: commits whose render pass **began** in `[startMs, endMs]`.
 */
export function sliceWindow(
  commits: CommitRecord[],
  startMs: number,
  endMs: number,
): CommitRecord[] {
  return commits.filter((c) => c.at >= startMs && c.at <= endMs)
}

/**
 * Disambiguate duplicate keys via ownerPath when two distinct types share a key.
 * Spec: componentKey = displayName ?? name ?? '<anonymous>', disambiguated by owner chain.
 */
function tallyKey(fiber: { key: string; ownerPath: string }, seen: Map<string, Set<string>>): string {
  const owners = seen.get(fiber.key) ?? new Set()
  owners.add(fiber.ownerPath)
  seen.set(fiber.key, owners)
  // First pass collects; second pass (below) applies suffixes when needed.
  return fiber.key
}

export function aggregateRepetition(commits: CommitRecord[]): RepetitionMetrics {
  const tally = new Map<string, number>()
  const keyOwners = new Map<string, Set<string>>()

  // First pass: discover which keys need owner-path disambiguation.
  for (const commit of commits) {
    for (const fiber of commit.rendered) {
      tallyKey(fiber, keyOwners)
    }
  }

  const needsOwner = new Set<string>()
  for (const [key, owners] of keyOwners) {
    if (owners.size > 1) needsOwner.add(key)
  }

  let componentRenders = 0
  let totalCommitDurationMs = 0
  let maxCommitDurationMs = 0

  for (const commit of commits) {
    totalCommitDurationMs += commit.durationMs
    if (commit.durationMs > maxCommitDurationMs) maxCommitDurationMs = commit.durationMs
    for (const fiber of commit.rendered) {
      componentRenders += 1
      const key = needsOwner.has(fiber.key)
        ? fiber.ownerPath || fiber.key
        : fiber.key
      tally.set(key, (tally.get(key) ?? 0) + 1)
    }
  }

  const renderTally: Record<string, number> = {}
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  for (const [k, v] of sorted) renderTally[k] = v

  return {
    commits: commits.length,
    componentRenders,
    distinctComponents: tally.size,
    renderTally,
    totalCommitDurationMs,
    maxCommitDurationMs,
  }
}

/** Median of a non-empty number list. Even count → average of the two middle values. */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function aggregateScenario(
  reps: RepetitionMetrics[],
  meta: { id: string; label: string; selector: string; skipped?: { reason: string } },
): ScenarioMetrics {
  if (meta.skipped) {
    return {
      id: meta.id,
      label: meta.label,
      selector: meta.selector,
      repetitions: [],
      medianComponentRenders: 0,
      medianTotalCommitDurationMs: 0,
      minTotalCommitDurationMs: 0,
      maxTotalCommitDurationMs: 0,
      deterministic: false,
      skipped: meta.skipped,
    }
  }

  const renders = reps.map((r) => r.componentRenders)
  const durations = reps.map((r) => r.totalCommitDurationMs)
  const first = renders[0]
  const deterministic = renders.length > 0 && renders.every((v) => v === first)

  return {
    id: meta.id,
    label: meta.label,
    selector: meta.selector,
    repetitions: reps,
    medianComponentRenders: median(renders),
    medianTotalCommitDurationMs: median(durations),
    minTotalCommitDurationMs: durations.length ? Math.min(...durations) : 0,
    maxTotalCommitDurationMs: durations.length ? Math.max(...durations) : 0,
    deterministic,
  }
}
