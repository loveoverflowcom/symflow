import { describe, expect, it } from 'vitest';
import {
  appendSequentialStep,
  defaultTaskConfig,
  nestedStepGroups,
  reorderSteps,
  uniqueStepId,
  type DslStep,
  type TaskMeta
} from '../src/lib/utils/dsl-tree';

describe('DSL block tree utilities', () => {
  const steps: DslStep[] = [
    { id: 'a', type: 'manual_trigger', needs: [], with: {} },
    { id: 'b', type: 'web_scraper', needs: ['a'], with: {} },
    { id: 'c', type: 'ai_agent', needs: ['b'], with: {} }
  ];

  it('reorders sequential steps and recalculates inferred needs', () => {
    expect(reorderSteps(steps, 2, 1).map((step) => [step.id, step.needs])).toEqual([
      ['a', []],
      ['c', ['a']],
      ['b', ['c']]
    ]);
  });

  it('preserves explicit non-sequential dependencies', () => {
    const branched = [
      ...steps.slice(0, 2),
      { ...steps[2], needs: ['a', 'b'] }
    ];
    expect(reorderSteps(branched, 2, 1)[1].needs).toEqual(['a', 'b']);
  });

  it('appends a step sequentially and creates unique ids', () => {
    const id = uniqueStepId('manual_trigger', [
      { id: 'manual_trigger_1', type: 'manual_trigger' }
    ]);
    const result = appendSequentialStep(steps, { id, type: 'manual_trigger', with: {} });

    expect(id).toBe('manual_trigger_2');
    expect(result[3].needs).toEqual(['c']);
  });

  it('builds defaults from task schemas and exposes nested groups', () => {
    const task: TaskMeta = {
      name: 'foreach',
      label: 'For Each',
      input_schema: {
        items: { type: 'array', default: [] },
        as: { type: 'string', default: 'item' }
      },
      output_schema: {}
    };
    expect(defaultTaskConfig(task)).toEqual({ items: [], as: 'item' });

    const groups = nestedStepGroups({
      id: 'loop',
      type: 'foreach',
      with: { steps: [{ id: 'nested', type: 'manual_trigger' }] }
    });
    expect(groups[0].steps[0].id).toBe('nested');
  });
});
