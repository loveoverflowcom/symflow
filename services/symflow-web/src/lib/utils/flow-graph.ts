import type { Edge, Node } from '@xyflow/svelte';

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  stepType: string;
  config: Record<string, unknown>;
}

export interface DslStep {
  id: string;
  type: string;
  depends_on?: string[];
  with?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DslFlow {
  flow_id: string;
  name: string;
  steps: DslStep[];
}

export type FlowNode = Node<FlowNodeData>;

const NODE_TYPE_MAP: Record<string, string> = {
  manual_trigger: 'manualTrigger',
  web_scraper: 'webScraper',
  local_file_reader: 'localFileReader'
};

export function mapStepTypeToNodeType(stepType: string): string {
  return NODE_TYPE_MAP[stepType] ?? 'agentNode';
}

export function dslToGraph(dsl: DslFlow): { nodes: FlowNode[]; edges: Edge[] } {
  const steps = Array.isArray(dsl.steps) ? dsl.steps : [];
  const nodes: FlowNode[] = steps.map((step, index) => ({
    id: step.id,
    type: mapStepTypeToNodeType(step.type),
    position: {
      x: (index % 4) * 250,
      y: Math.floor(index / 4) * 190 + 80
    },
    data: {
      label: step.id,
      stepType: step.type,
      config: step.with ?? {}
    }
  }));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: Edge[] = [];

  steps.forEach((step, index) => {
    const dependencies =
      step.depends_on && step.depends_on.length > 0
        ? step.depends_on
        : index > 0
          ? [steps[index - 1].id]
          : [];

    dependencies.forEach((source) => {
      if (!nodeIds.has(source) || source === step.id) return;
      edges.push({
        id: `${source}->${step.id}`,
        source,
        target: step.id,
        type: 'smoothstep',
        animated: Boolean(step.depends_on?.length)
      });
    });
  });

  return { nodes, edges };
}

export function graphToDsl(
  flowId: string,
  flowName: string,
  nodes: FlowNode[],
  edges: Edge[]
): DslFlow {
  const validIds = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter(
    (edge) => validIds.has(edge.source) && validIds.has(edge.target) && edge.source !== edge.target
  );
  const order = topoSort(nodes.map((node) => node.id), validEdges);

  const steps = order.map((nodeId, index): DslStep => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      throw new Error(`Missing graph node: ${nodeId}`);
    }

    const dependencies = [
      ...new Set(validEdges.filter((edge) => edge.target === nodeId).map((edge) => edge.source))
    ];
    const isSequential =
      dependencies.length === 1 && index > 0 && dependencies[0] === order[index - 1];

    return {
      id: node.id,
      type: node.data.stepType,
      ...(!isSequential && dependencies.length > 0 ? { depends_on: dependencies } : {}),
      with: node.data.config ?? {}
    };
  });

  return {
    flow_id: flowId,
    name: flowName,
    steps
  };
}

export function topoSort(ids: string[], edges: Edge[]): string[] {
  const inDegree = new Map(ids.map((id) => [id, 0]));
  const adjacency = new Map(ids.map((id) => [id, [] as string[]]));

  edges.forEach(({ source, target }) => {
    if (!inDegree.has(source) || !inDegree.has(target)) return;
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    adjacency.get(source)?.push(target);
  });

  const queue = ids.filter((id) => inDegree.get(id) === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    result.push(nodeId);

    adjacency.get(nodeId)?.forEach((neighbor) => {
      const degree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, degree);
      if (degree === 0) queue.push(neighbor);
    });
  }

  return result.length === ids.length ? result : ids;
}
