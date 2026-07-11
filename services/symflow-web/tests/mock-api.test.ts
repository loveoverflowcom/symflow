import { describe, expect, it } from 'vitest';
import { getFlowMock, getRunMock, listFlowsMock, saveFlowMock, saveRunMock } from '../src/lib/api/mock';

describe('mock api', () => {
  it('saves flows and makes them available to list/get calls', async () => {
    const dsl = 'export async function main() { return {}; }';
    const saved = await saveFlowMock({
      name: 'Test flow',
      dsl_script: dsl
    });

    const flows = await listFlowsMock();
    expect(flows.some((flow) => flow.id === saved.id)).toBe(true);

    const fetched = await getFlowMock(saved.id);
    expect(fetched).toMatchObject({
      id: saved.id,
      name: 'Test flow',
      dsl_script: dsl
    });
  });

  it('creates a run and resolves it on readback', async () => {
    const run = await saveRunMock({
      flow_id: 'demo-flow',
      initial_input: {},
      status: 'SUCCESS',
      output: { ok: true },
      logs: []
    });

    expect(run.status).toBe('SUCCESS');

    const resolved = await getRunMock(run.id);
    expect(resolved.status).toBe('SUCCESS');
    expect(resolved.output).toEqual({ ok: true });
  });
});
