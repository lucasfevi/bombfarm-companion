/**
 * Pure aggregation over collected commits — same shape as the web planner's perf harness
 * aggregation, ported rather than imported (see render-count-collector.mjs's header).
 */

/** Inclusive window: commits whose render pass began in [startMs, endMs]. */
export function sliceWindow(commits, startMs, endMs) {
  return commits.filter((c) => c.at >= startMs && c.at <= endMs);
}

export function aggregateCommits(commits) {
  const tally = new Map();
  const keyOwners = new Map();

  for (const commit of commits) {
    for (const fiber of commit.rendered) {
      const owners = keyOwners.get(fiber.key) ?? new Set();
      owners.add(fiber.ownerPath);
      keyOwners.set(fiber.key, owners);
    }
  }

  const needsOwner = new Set();
  for (const [key, owners] of keyOwners) {
    if (owners.size > 1) needsOwner.add(key);
  }

  let componentRenders = 0;
  let totalCommitDurationMs = 0;

  for (const commit of commits) {
    totalCommitDurationMs += commit.durationMs;
    for (const fiber of commit.rendered) {
      componentRenders += 1;
      const key = needsOwner.has(fiber.key) ? fiber.ownerPath || fiber.key : fiber.key;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }

  const renderTally = {};
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [k, v] of sorted) renderTally[k] = v;

  return {
    commits: commits.length,
    componentRenders,
    distinctComponents: tally.size,
    renderTally,
    totalCommitDurationMs,
  };
}
