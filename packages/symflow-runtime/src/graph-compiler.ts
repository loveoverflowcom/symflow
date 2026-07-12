import type { JsonSchema, TaskMeta } from './types';

/** A reference to a named task input or output port. */
export interface WorkflowGraphPort {
  nodeId: string;
  port: string;
}

/** A value supplied to `main(input)` and exposed as a graph source port. */
export interface WorkflowGraphInput {
  name: string;
  schema: JsonSchema;
  required?: boolean;
  /** True when the editor created this input to satisfy a required task port. */
  implicit?: boolean;
  position?: WorkflowGraphPosition;
}

export type WorkflowPortDataType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'object'
  | 'json'
  | 'array'
  | 'file'
  | 'binary';

/** Serializable port metadata used by graph editors. Task schemas remain authoritative. */
export interface WorkflowGraphPortDefinition {
  name: string;
  label?: string;
  dataType: WorkflowPortDataType;
  required?: boolean;
}

export interface WorkflowGraphInputPort {
  input: string;
}

export type WorkflowGraphSource = WorkflowGraphPort | WorkflowGraphInputPort;

/** Connects one task output to one task input. */
export interface WorkflowGraphEdge {
  source: WorkflowGraphSource;
  target: WorkflowGraphPort;
}

/**
 * A task invocation in the visual workflow graph.
 *
 * `name` must match a task name from the task registry. Values in
 * `configuration` are literal inputs; an edge supplies the remaining inputs.
 */
export interface WorkflowGraphNode {
  id: string;
  type: 'task';
  name: string;
  label?: string;
  inputs?: WorkflowGraphPortDefinition[];
  outputs?: WorkflowGraphPortDefinition[];
  configuration?: Record<string, unknown>;
  /** Canvas position, kept as editor metadata and ignored by the compiler. */
  position?: WorkflowGraphPosition;
}

export interface WorkflowGraphPosition {
  x: number;
  y: number;
}

/** A serialisable graph that can be compiled to a TypeScript workflow. */
export interface WorkflowGraph {
  nodes: WorkflowGraphNode[];
  inputs?: WorkflowGraphInput[];
  edges?: WorkflowGraphEdge[];
  /** Named values returned from `main`. When omitted, all terminal node results are returned. */
  outputs?: Record<string, WorkflowGraphPort>;
}

export interface GraphCompileError {
  code:
    | 'duplicate_node_id'
    | 'empty_graph'
    | 'invalid_configuration'
    | 'invalid_node'
    | 'invalid_output'
    | 'missing_input'
    | 'unknown_node'
    | 'unknown_port'
    | 'unknown_task'
    | 'cycle'
    | 'duplicate_input_connection'
    | 'incompatible_ports'
    | 'incompatible_port_type'
    | 'invalid_binding_order';
  message: string;
  nodeId?: string;
  port?: string;
}

export interface GraphCompileResult {
  source?: string;
  errors: GraphCompileError[];
}

/**
 * Validates a task graph and compiles it to the TypeScript format executed by
 * `executeWorkflow`. This MVP supports task nodes and acyclic data edges.
 */
export function compileWorkflowGraph(graph: WorkflowGraph, tasks: TaskMeta[]): GraphCompileResult {
  const errors: GraphCompileError[] = [];
  const nodes = new Map<string, WorkflowGraphNode>();
  const inputs = new Map<string, WorkflowGraphInput>();
  const taskByName = new Map(tasks.map((task) => [task.name, task]));
  const edges = graph.edges ?? [];
  const nodeOrder = new Map(graph.nodes?.map((node, index) => [node?.id, index]) ?? []);

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return { errors: [{ code: 'empty_graph', message: 'A workflow graph needs at least one task node.' }] };
  }

  for (const input of graph.inputs ?? []) {
    if (!input || !isNonEmptyString(input.name) || !isJsonObject(input.schema)) {
      errors.push({ code: 'invalid_node', message: 'Each workflow input needs a name and JSON schema.' });
      continue;
    }
    if (inputs.has(input.name)) {
      errors.push({ code: 'duplicate_node_id', message: `Duplicate workflow input "${input.name}".` });
      continue;
    }
    inputs.set(input.name, input);
  }

  for (const node of graph.nodes) {
    if (!node || node.type !== 'task' || !isNonEmptyString(node.id) || !isNonEmptyString(node.name)) {
      errors.push({ code: 'invalid_node', message: 'Each node needs a non-empty id, type "task", and task name.' });
      continue;
    }
    if (nodes.has(node.id)) {
      errors.push({ code: 'duplicate_node_id', nodeId: node.id, message: `Duplicate node id "${node.id}".` });
      continue;
    }
    if (node.configuration !== undefined && (!isJsonObject(node.configuration) || !isJsonValue(node.configuration))) {
      errors.push({
        code: 'invalid_configuration',
        nodeId: node.id,
        message: `Configuration for node "${node.id}" must be a JSON object.`
      });
    }
    if (!taskByName.has(node.name)) {
      errors.push({ code: 'unknown_task', nodeId: node.id, message: `Task "${node.name}" is not in the registry.` });
    }
    const task = taskByName.get(node.name);
    if (task) validatePortDefinitions(node, task, errors);
    nodes.set(node.id, node);
  }

  const incoming = new Map<string, WorkflowGraphEdge>();
  const outgoing = new Map<string, WorkflowGraphEdge[]>();
  for (const edge of edges) {
    const sourceInputPort = isWorkflowInputPort(edge.source) ? edge.source : undefined;
    const sourcePort = isWorkflowInputPort(edge.source) ? undefined : edge.source;
    const sourceNode = sourcePort ? nodes.get(sourcePort.nodeId) : undefined;
    const targetNode = nodes.get(edge?.target?.nodeId);
    if (sourcePort && !sourceNode) {
      errors.push({ code: 'unknown_node', message: `Edge source node "${sourcePort.nodeId}" does not exist.` });
      continue;
    }
    if (!targetNode) {
      errors.push({ code: 'unknown_node', message: `Edge target node "${edge?.target?.nodeId ?? ''}" does not exist.` });
      continue;
    }
    if ((sourcePort && !isNonEmptyString(sourcePort.port)) || !isNonEmptyString(edge.target.port)) {
      errors.push({ code: 'unknown_port', message: 'Every edge must name a source and target port.' });
      continue;
    }

    const sourceInput = sourceInputPort ? inputs.get(sourceInputPort.input) : undefined;
    if (sourceInputPort && !sourceInput) {
      errors.push({ code: 'unknown_port', port: sourceInputPort.input, message: `Workflow input "${sourceInputPort.input}" does not exist.` });
      continue;
    }
    const sourceTask = sourceNode && taskByName.get(sourceNode.name);
    const targetTask = taskByName.get(targetNode.name);
    if (sourceNode && (nodeOrder.get(sourceNode.id) ?? -1) >= (nodeOrder.get(targetNode.id) ?? -1)) {
      errors.push({
        code: 'invalid_binding_order', nodeId: targetNode.id, port: edge.target.port,
        message: `Input "${targetNode.id}.${edge.target.port}" must bind to an earlier task output.`
      });
      continue;
    }
    const sourceSchema = sourceInputPort ? sourceInput?.schema : sourceTask && outputPortSchema(sourceTask.output_schema, sourcePort!.port);
    const targetSchema = targetTask && inputPortSchema(targetTask.input_schema, edge.target.port);
    if (!sourceSchema) {
      errors.push({
        code: 'unknown_port', nodeId: sourceNode?.id, port: sourceInputPort?.input ?? sourcePort?.port,
        message: sourceInputPort
          ? `Workflow input "${sourceInputPort.input}" is invalid.`
          : `Output port "${sourcePort?.port}" does not exist on node "${sourceNode?.id}".`
      });
      continue;
    }
    if (!targetSchema) {
      errors.push({
        code: 'unknown_port', nodeId: targetNode.id, port: edge.target.port,
        message: `Input port "${edge.target.port}" does not exist on node "${targetNode.id}".`
      });
      continue;
    }
    const targetKey = portKey(edge.target);
    if (incoming.has(targetKey)) {
      errors.push({
        code: 'duplicate_input_connection', nodeId: targetNode.id, port: edge.target.port,
        message: `Input "${edge.target.port}" on node "${targetNode.id}" has more than one connection.`
      });
      continue;
    }
    if (!schemasAreCompatible(sourceSchema, targetSchema)) {
      errors.push({
        code: 'incompatible_ports', nodeId: targetNode.id, port: edge.target.port,
        message: `Source "${sourceLabel(edge.source)}" is incompatible with input "${targetNode.id}.${edge.target.port}".`
      });
      continue;
    }
    incoming.set(targetKey, edge);
    if (sourceNode) {
      const sourceEdges = outgoing.get(sourceNode.id) ?? [];
      sourceEdges.push(edge);
      outgoing.set(sourceNode.id, sourceEdges);
    }
  }

  for (const node of nodes.values()) {
    const task = taskByName.get(node.name);
    if (!task) continue;
    for (const input of requiredProperties(task.input_schema)) {
      if (!incoming.has(portKey({ nodeId: node.id, port: input }))) {
        errors.push({
          code: 'missing_input', nodeId: node.id, port: input,
          message: `Required input "${input}" on node "${node.id}" is not bound to a source.`
        });
      }
    }
  }

  const order = topologicalOrder(nodes, outgoing, errors);
  validateOutputs(graph.outputs, nodes, taskByName, errors);
  if (errors.length > 0) return { errors };

  return { source: generateSource(order, incoming, outgoing, graph.outputs, Array.from(inputs.values())), errors: [] };
}

function topologicalOrder(
  nodes: Map<string, WorkflowGraphNode>,
  outgoing: Map<string, WorkflowGraphEdge[]>,
  errors: GraphCompileError[]
): WorkflowGraphNode[] {
  const indegree = new Map(Array.from(nodes.keys(), (id) => [id, 0]));
  for (const edges of outgoing.values()) {
    for (const edge of edges) indegree.set(edge.target.nodeId, (indegree.get(edge.target.nodeId) ?? 0) + 1);
  }

  const ready = Array.from(nodes.values()).filter((node) => indegree.get(node.id) === 0);
  const order: WorkflowGraphNode[] = [];
  for (let index = 0; index < ready.length; index += 1) {
    const node = ready[index];
    order.push(node);
    for (const edge of outgoing.get(node.id) ?? []) {
      const next = (indegree.get(edge.target.nodeId) ?? 1) - 1;
      indegree.set(edge.target.nodeId, next);
      if (next === 0) ready.push(nodes.get(edge.target.nodeId)!);
    }
  }

  if (order.length !== nodes.size) {
    errors.push({ code: 'cycle', message: 'Workflow graph contains a cycle.' });
  }
  return order;
}

function validateOutputs(
  outputs: WorkflowGraph['outputs'],
  nodes: Map<string, WorkflowGraphNode>,
  taskByName: Map<string, TaskMeta>,
  errors: GraphCompileError[]
): void {
  for (const [name, port] of Object.entries(outputs ?? {})) {
    const node = nodes.get(port?.nodeId);
    const task = node && taskByName.get(node.name);
    if (!isNonEmptyString(name) || !node || !task || !isNonEmptyString(port?.port) || !outputPortSchema(task.output_schema, port.port)) {
      errors.push({ code: 'invalid_output', message: `Workflow output "${name}" must reference an existing task output port.` });
    }
  }
}

function generateSource(
  order: WorkflowGraphNode[],
  incoming: Map<string, WorkflowGraphEdge>,
  outgoing: Map<string, WorkflowGraphEdge[]>,
  outputs: WorkflowGraph['outputs'],
  workflowInputs: WorkflowGraphInput[]
): string {
  const variableForNode = new Map(order.map((node, index) => [node.id, `node${index + 1}`]));
  const calls = order.map((node) => {
    const inputs = new Map<string, string>();
    for (const [key, value] of Object.entries(node.configuration ?? {})) {
      inputs.set(key, toJsonLiteral(value));
    }
    for (const edge of incoming.values()) {
      if (edge.target.nodeId !== node.id) continue;
      inputs.set(edge.target.port, sourceExpression(variableForNode, edge.source));
    }
    const object = Array.from(inputs, ([key, value]) => `    ${JSON.stringify(key)}: ${value}`).join(',\n');
    return `  const ${variableForNode.get(node.id)} = await task(${JSON.stringify(node.name)}, {\n${object}\n  });`;
  });

  const resultEntries = outputs
    ? Object.entries(outputs).map(([name, port]) => `    ${JSON.stringify(name)}: ${portExpression(variableForNode, port)}`)
    : order
      .filter((node) => (outgoing.get(node.id) ?? []).length === 0)
      .map((node) => `    ${JSON.stringify(node.id)}: ${variableForNode.get(node.id)}`);

  return [
    "import { task } from '@symflow/runtime';",
    workflowInputs.some((input) => input.schema.format === 'binary')
      ? "import type { WorkflowFile } from '@symflow/runtime';"
      : '',
    '',
    workflowInputInterface(workflowInputs),
    workflowInputs.length > 0 ? 'export async function main(input: WorkflowInput) {' : 'export async function main() {',
    ...calls,
    '  return {',
    resultEntries.join(',\n'),
    '  };',
    '}',
    ''
  ].join('\n');
}

function workflowInputInterface(inputs: WorkflowGraphInput[]): string {
  if (inputs.length === 0) return '';
  const fields = inputs.map((input) => `  ${JSON.stringify(input.name)}${input.required === false ? '?' : ''}: ${schemaToType(input.schema)};`);
  return ['export interface WorkflowInput {', ...fields, '}'].join('\n');
}

function schemaToType(schema: JsonSchema): string {
  if (schema.format === 'binary') return 'WorkflowFile';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array') return `Array<${schemaToType(schemaObject(schema.items))}>`;
  if (schema.type === 'object') return 'Record<string, unknown>';
  return 'unknown';
}

function sourceExpression(variables: Map<string, string>, source: WorkflowGraphSource): string {
  return isWorkflowInputPort(source) ? `input[${JSON.stringify(source.input)}]` : portExpression(variables, source);
}

function portExpression(variables: Map<string, string>, port: WorkflowGraphPort): string {
  const variable = variables.get(port.nodeId)!;
  return port.port === '$result' ? variable : `${variable}[${JSON.stringify(port.port)}]`;
}

function sourceLabel(source: WorkflowGraphSource): string {
  return isWorkflowInputPort(source) ? `input.${source.input}` : `${source.nodeId}.${source.port}`;
}

function isWorkflowInputPort(source: WorkflowGraphSource): source is WorkflowGraphInputPort {
  return 'input' in source;
}

function outputPortSchema(schema: JsonSchema, port: string): JsonSchema | undefined {
  const properties = schema.properties;
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    const value = (properties as Record<string, unknown>)[port];
    return isJsonObject(value) ? value : undefined;
  }
  return port === '$result' ? schema : undefined;
}

function inputPortSchema(schema: JsonSchema, port: string): JsonSchema | undefined {
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return undefined;
  const value = (properties as Record<string, unknown>)[port];
  return isJsonObject(value) ? value : undefined;
}

function requiredProperties(schema: JsonSchema): string[] {
  return Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [];
}

function schemasAreCompatible(source: JsonSchema, target: JsonSchema): boolean {
  if (target.format === 'binary' && source.format !== 'binary') return false;
  const sourceType = schemaType(source);
  const targetType = schemaType(target);
  if (!sourceType || !targetType || sourceType === targetType) return true;
  if (sourceType === 'integer' && targetType === 'number') return true;
  if (sourceType === 'array' && targetType === 'array') return schemasAreCompatible(schemaObject(source.items), schemaObject(target.items));
  return false;
}

/** Returns the stable UI data type represented by a JSON schema. */
export function workflowPortDataType(schema: JsonSchema | undefined): WorkflowPortDataType {
  if (schema?.format === 'binary') return 'file';
  if (schema?.type === 'number' || schema?.type === 'integer') return 'number';
  if (schema?.type === 'boolean') return 'boolean';
  if (schema?.type === 'object') return 'object';
  if (schema?.type === 'array') return 'array';
  return 'string';
}

/** Converts editor port metadata back to the minimal schema used for validation. */
export function workflowPortSchema(dataType: WorkflowPortDataType): JsonSchema {
  if (dataType === 'file' || dataType === 'binary') return { type: 'string', format: 'binary' };
  if (dataType === 'text') return { type: 'string' };
  if (dataType === 'json') return { type: 'object' };
  return { type: dataType };
}

export function workflowPortTypesAreCompatible(source: WorkflowPortDataType, target: WorkflowPortDataType): boolean {
  return schemasAreCompatible(workflowPortSchema(source), workflowPortSchema(target));
}

function validatePortDefinitions(node: WorkflowGraphNode, task: TaskMeta, errors: GraphCompileError[]): void {
  for (const [direction, definitions, schema] of [
    ['input', node.inputs, task.input_schema],
    ['output', node.outputs, task.output_schema]
  ] as const) {
    for (const port of definitions ?? []) {
      const declared = direction === 'input'
        ? inputPortSchema(schema, port.name)
        : outputPortSchema(schema, port.name);
      if (!declared) {
        errors.push({ code: 'unknown_port', nodeId: node.id, port: port.name, message: `${direction === 'input' ? 'Input' : 'Output'} port "${port.name}" does not exist on node "${node.id}".` });
      } else if (!schemasAreCompatible(workflowPortSchema(port.dataType), declared) || !schemasAreCompatible(declared, workflowPortSchema(port.dataType))) {
        errors.push({
          code: 'incompatible_port_type', nodeId: node.id, port: port.name,
          message: `Type "${port.dataType}" is incompatible with the declared ${direction} "${node.id}.${port.name}".`
        });
      }
    }
  }
}

function schemaType(schema: JsonSchema): string | undefined {
  const { type } = schema;
  return typeof type === 'string' ? type : undefined;
}

function schemaObject(value: unknown): JsonSchema {
  return isJsonObject(value) ? value : {};
}

function portKey(port: WorkflowGraphPort): string {
  return `${port.nodeId}\u0000${port.port}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isJsonObject(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(isJsonValue);
}

function toJsonLiteral(value: unknown): string {
  const literal = JSON.stringify(value);
  if (literal === undefined) {
    throw new Error('Graph configuration must contain JSON values.');
  }
  return literal;
}
