import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOW_DSL, formatJsonDsl, parseJsonDsl } from '../src/lib/utils/dsl';

describe('JSON flow DSL utilities', () => {
  it('provides a valid new-flow template', () => {
    const flow = parseJsonDsl(DEFAULT_FLOW_DSL) as {
      flow_id: string;
      steps: Array<{ type: string; with: unknown }>;
    };

    expect(flow.flow_id).toBe('new-flow');
    expect(flow.steps[0]).toMatchObject({
      type: 'manual_trigger',
      with: { message: 'Hello from Symflow' }
    });
  });

  it('pretty-prints valid JSON', () => {
    expect(formatJsonDsl('{"flow_id":"compact","steps":[]}')).toContain(
      '\n  "flow_id": "compact"'
    );
  });

  it('rejects malformed JSON', () => {
    expect(() => parseJsonDsl('flow_id: yaml')).toThrow();
  });
});
