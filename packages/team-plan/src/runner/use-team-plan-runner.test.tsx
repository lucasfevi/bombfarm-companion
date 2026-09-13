import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTeamPlanRunner, type TeamPlanRunnerHandle } from './team-plan-runner-core';
import { useTeamPlanRunner } from './use-team-plan-runner';

function Probe({ runner }: { runner?: TeamPlanRunnerHandle }) {
  const state = useTeamPlanRunner(runner ? { runner } : undefined);
  return createElement('div', null, `${state.status}:${state.runId ?? 'none'}`);
}

function neverRespondingWorkerFactory() {
  return () => ({
    onmessage: null,
    onerror: null,
    terminate() {},
    postMessage() {},
  });
}

describe('useTeamPlanRunner with a host-given runner', () => {
  it('subscribes to the given instance and reflects its state, rather than creating one', () => {
    const runner = createTeamPlanRunner({ createWorker: neverRespondingWorkerFactory() });
    runner.run({} as never);

    const html = renderToStaticMarkup(createElement(Probe, { runner }));

    expect(html).toContain('running:1');
  });

  it('creates its own runner, starting idle with no run id, when none is given', () => {
    const html = renderToStaticMarkup(createElement(Probe, {}));

    expect(html).toContain('idle:none');
  });
});
