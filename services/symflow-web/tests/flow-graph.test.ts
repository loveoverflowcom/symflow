import { describe, expect, it } from 'vitest';
import { dslToGraph, graphToDsl, topoSort, type DslFlow } from '../src/lib/utils/flow-graph';

describe('flow graph conversion', () => {
  const dsl: DslFlow = {
    flow_id: 'research',
    name: 'Research',
    steps: [
      { id: 'start', type: 'manual_trigger', with: { prompt: 'Go' } },
      { id: 'scrape', type: 'web_scraper', depends_on: ['start'], with: { url: 'https://example.com' } },
      { id: 'summarize', type: 'core_agent', depends_on: ['start'], with: { model: 'test' } }
    ]
  };

  it('creates nodes and explicit dependency edges from DSL', () => {
    const graph = dslToGraph(dsl);

    expect(graph.nodes.map((node) => node.type)).toEqual([
      'manualTrigger',
      'webScraper',
      'agentNode'
    ]);
    expect(graph.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['start', 'scrape'],
      ['start', 'summarize']
    ]);
  });

  it('preserves non-sequential single dependencies when serializing', () => {
    const graph = dslToGraph(dsl);
    const result = graphToDsl(dsl.flow_id, dsl.name, graph.nodes, graph.edges);

    expect(result.steps[2].depends_on).toEqual(['start']);
    expect(result.steps[1].depends_on).toBeUndefined();
  });

  it('falls back to original order when the graph contains a cycle', () => {
    const ids = ['a', 'b'];
    expect(
      topoSort(ids, [
        { id: 'a-b', source: 'a', target: 'b' },
        { id: 'b-a', source: 'b', target: 'a' }
      ])
    ).toEqual(ids);
  });
});
