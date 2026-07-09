import { describe, expect, it } from 'vitest';
import { getFlowMock, getRunMock, listFlowsMock, saveFlowMock, triggerRunMock } from '../src/lib/api/mock';

describe('mock api', () => {
  it('saves flows and makes them available to list/get calls', async () => {
    const dsl = '{"flow_id":"test-flow","name":"Test flow","steps":[]}';
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
      dsl_script: JSON.stringify(JSON.parse(dsl), null, 2)
    });
  });

  it('creates a run and resolves it on readback', async () => {
    const run = await triggerRunMock('demo-flow');

    expect(run.status).toBe('RUNNING');
    expect(run.steps).toHaveLength(2);

    const resolved = await getRunMock(run.id);
    expect(resolved.status).toBe('SUCCESS');
    expect(resolved.steps?.[1].status).toBe('COMPLETED');
    expect(Array.isArray(resolved.steps?.[1].agent_logs)).toBe(true);
  });
});
