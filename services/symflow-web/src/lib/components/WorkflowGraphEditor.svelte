<script lang="ts">
  import type {
    FieldSchema,
    GraphCompileError,
    JsonSchema,
    TaskMeta,
    WorkflowGraph,
    WorkflowGraphEdge,
    WorkflowGraphInput,
    WorkflowGraphNode,
    WorkflowGraphPortDefinition,
    WorkflowGraphSource,
    WorkflowInputSchema,
    WorkflowPortDataType
  } from '@symflow/runtime';
  import { workflowPortDataType, workflowPortSchema, workflowPortTypesAreCompatible } from '@symflow/runtime';
  import WorkflowInputForm from './WorkflowInputForm.svelte';

  const INPUT_TYPES: WorkflowPortDataType[] = ['string', 'number', 'boolean', 'object', 'array', 'file'];

  let {
    graph = $bindable<WorkflowGraph>({ nodes: [] }),
    inputValues = $bindable<Record<string, unknown>>({}),
    tasks = [],
    errors = [],
    disabled = false
  } = $props<{
    graph?: WorkflowGraph;
    inputValues?: Record<string, unknown>;
    tasks?: TaskMeta[];
    errors?: GraphCompileError[];
    disabled?: boolean;
  }>();

  let selectedTaskName = $state('');
  let newInputType = $state<WorkflowPortDataType>('string');
  let configText = $state<Record<string, string>>({});
  let configErrors = $state<Record<string, string>>({});

  const workflowInputSchema = $derived(inputFormSchema(graph.inputs ?? []));

  $effect(() => {
    if (!selectedTaskName && tasks.length > 0) selectedTaskName = tasks[0].name;
  });

  $effect(() => {
    if (tasks.length === 0 || graph.nodes.length === 0) return;
    const nextNodes = graph.nodes.map((node: WorkflowGraphNode) => {
      const task = taskFor(node);
      return task ? {
        ...node,
        label: task.label,
        inputs: portDefinitions(task.input_schema, true),
        outputs: outputPortDefinitions(task.output_schema)
      } : node;
    });
    if (JSON.stringify(nextNodes) !== JSON.stringify(graph.nodes)) graph = { ...graph, nodes: nextNodes };
  });

  function addNode() {
    const task = tasks.find((item: TaskMeta) => item.name === selectedTaskName);
    if (!task) return;
    const id = nextNodeId(task.name);
    const node: WorkflowGraphNode = {
      id,
      type: 'task',
      name: task.name,
      label: task.label,
      inputs: portDefinitions(task.input_schema, true),
      outputs: outputPortDefinitions(task.output_schema),
      configuration: defaultConfiguration(task)
    };
    graph = { ...graph, nodes: [...graph.nodes, node] };
    configText = { ...configText, [id]: JSON.stringify(node.configuration, null, 2) };
  }

  function addWorkflowInput() {
    const name = nextInputName(newInputType, graph.inputs ?? []);
    const input: WorkflowGraphInput = { name, schema: workflowPortSchema(newInputType), required: true };
    graph = { ...graph, inputs: [...(graph.inputs ?? []), input] };
    inputValues = { ...inputValues, [name]: defaultInputValue(newInputType) };
  }

  function removeWorkflowInput(name: string) {
    graph = {
      ...graph,
      inputs: (graph.inputs ?? []).filter((input: WorkflowGraphInput) => input.name !== name),
      edges: (graph.edges ?? []).filter((edge: WorkflowGraphEdge) => !isInputSource(edge.source, name))
    };
    const { [name]: _removed, ...remaining } = inputValues;
    inputValues = remaining;
  }

  function updateWorkflowInputType(name: string, dataType: WorkflowPortDataType) {
    graph = {
      ...graph,
      inputs: (graph.inputs ?? []).map((input: WorkflowGraphInput) => input.name === name
        ? { ...input, schema: workflowPortSchema(dataType) }
        : input),
      edges: (graph.edges ?? []).filter((edge: WorkflowGraphEdge) => {
        if (!isInputSource(edge.source, name)) return true;
        const target = nodeById(edge.target.nodeId);
        return !!target && workflowPortTypesAreCompatible(dataType, portDefinition(target, 'inputs', edge.target.port).dataType);
      })
    };
    inputValues = { ...inputValues, [name]: defaultInputValue(dataType) };
  }

  function removeNode(id: string) {
    graph = {
      ...graph,
      nodes: graph.nodes.filter((node: WorkflowGraphNode) => node.id !== id),
      edges: (graph.edges ?? []).filter((edge: WorkflowGraphEdge) =>
        (isInputSource(edge.source) || edge.source.nodeId !== id) && edge.target.nodeId !== id
      )
    };
  }

  function bindSource(node: WorkflowGraphNode, port: string, encodedSource: string) {
    const remainingEdges = (graph.edges ?? []).filter((edge: WorkflowGraphEdge) =>
      edge.target.nodeId !== node.id || edge.target.port !== port
    );
    if (!encodedSource) {
      graph = { ...graph, edges: remainingEdges };
      return;
    }
    const source = decodeSource(encodedSource);
    const option = sourceOptions(node, port).find((candidate) => sourceKey(candidate.source) === sourceKey(source));
    if (!option) return;
    graph = {
      ...graph,
      edges: [...remainingEdges, { source, target: { nodeId: node.id, port } }]
    };
  }

  function sourceOptions(node: WorkflowGraphNode, port: string): Array<{ source: WorkflowGraphSource; label: string }> {
    const targetType = portDefinition(node, 'inputs', port).dataType;
    const options: Array<{ source: WorkflowGraphSource; label: string }> = [];
    for (const input of graph.inputs ?? []) {
      if (workflowPortTypesAreCompatible(workflowPortDataType(input.schema), targetType)) {
        options.push({ source: { input: input.name }, label: `input.${input.name}` });
      }
    }
    const nodeIndex = graph.nodes.findIndex((candidate: WorkflowGraphNode) => candidate.id === node.id);
    for (const earlierNode of graph.nodes.slice(0, nodeIndex)) {
      for (const output of outputPorts(earlierNode)) {
        if (workflowPortTypesAreCompatible(portDefinition(earlierNode, 'outputs', output).dataType, targetType)) {
          options.push({ source: { nodeId: earlierNode.id, port: output }, label: `${earlierNode.id}.${output}` });
        }
      }
    }
    return options;
  }

  function selectedSource(nodeId: string, port: string): string {
    const edge = (graph.edges ?? []).find((candidate: WorkflowGraphEdge) =>
      candidate.target.nodeId === nodeId && candidate.target.port === port
    );
    return edge ? sourceKey(edge.source) : '';
  }

  function bindingWarning(node: WorkflowGraphNode, port: string): string | null {
    const definition = portDefinition(node, 'inputs', port);
    const relevantError = errors.find((error: GraphCompileError) => error.nodeId === node.id && error.port === port);
    if (relevantError) return relevantError.message;
    if (definition.required && !selectedSource(node.id, port)) {
      return sourceOptions(node, port).length === 0
        ? 'Required input has no compatible earlier source.'
        : 'Required input is not bound.';
    }
    return null;
  }

  function updateConfiguration(node: WorkflowGraphNode, raw: string) {
    configText = { ...configText, [node.id]: raw };
    try {
      const configuration = JSON.parse(raw) as unknown;
      if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
        throw new Error('Configuration must be a JSON object.');
      }
      graph = {
        ...graph,
        nodes: graph.nodes.map((item: WorkflowGraphNode) => item.id === node.id
          ? { ...item, configuration: configuration as Record<string, unknown> }
          : item)
      };
      const { [node.id]: _ignored, ...remaining } = configErrors;
      configErrors = remaining;
    } catch (error) {
      configErrors = { ...configErrors, [node.id]: error instanceof Error ? error.message : 'Invalid JSON configuration.' };
    }
  }

  function inputFormSchema(inputs: WorkflowGraphInput[]): WorkflowInputSchema {
    const properties: Record<string, FieldSchema> = {};
    const required: string[] = [];
    for (const input of inputs) {
      const type = input.schema.type;
      if (type !== 'string' && type !== 'number' && type !== 'boolean' && type !== 'object' && type !== 'array') continue;
      properties[input.name] = {
        type,
        ...(input.schema.format === 'binary' ? { format: 'binary' as const } : {})
      };
      if (input.required !== false) required.push(input.name);
    }
    return { type: 'object', properties, required };
  }

  function nextInputName(dataType: WorkflowPortDataType, inputs: WorkflowGraphInput[]): string {
    const prefix = dataType === 'file' || dataType === 'binary'
      ? 'file'
      : dataType === 'text' ? 'string' : dataType === 'json' ? 'object' : dataType;
    const names = new Set(inputs.map((input) => input.name));
    let suffix = 1;
    while (names.has(`${prefix}_${suffix}`)) suffix += 1;
    return `${prefix}_${suffix}`;
  }

  function defaultInputValue(dataType: WorkflowPortDataType): unknown {
    if (dataType === 'boolean') return false;
    if (dataType === 'number') return undefined;
    if (dataType === 'array') return [];
    if (dataType === 'object' || dataType === 'json') return {};
    return '';
  }

  function taskFor(node: WorkflowGraphNode | undefined): TaskMeta | undefined {
    return node ? tasks.find((task: TaskMeta) => task.name === node.name) : undefined;
  }

  function nodeById(id: string): WorkflowGraphNode | undefined {
    return graph.nodes.find((node: WorkflowGraphNode) => node.id === id);
  }

  function inputPorts(node: WorkflowGraphNode): string[] {
    return node.inputs?.map((port) => port.name) ?? schemaPorts(taskFor(node)?.input_schema);
  }

  function outputPorts(node: WorkflowGraphNode): string[] {
    if (node.outputs) return node.outputs.map((port) => port.name);
    const schema = taskFor(node)?.output_schema;
    const ports = schemaPorts(schema);
    return ports.length > 0 ? ports : schema ? ['$result'] : [];
  }

  function inputSchema(node: WorkflowGraphNode, port: string): JsonSchema | undefined {
    return portSchema(taskFor(node)?.input_schema, port);
  }

  function outputSchema(node: WorkflowGraphNode, port: string): JsonSchema | undefined {
    const schema = taskFor(node)?.output_schema;
    return port === '$result' ? schema : portSchema(schema, port);
  }

  function portDefinition(node: WorkflowGraphNode, direction: 'inputs' | 'outputs', name: string): WorkflowGraphPortDefinition {
    const definition = node[direction]?.find((port) => port.name === name);
    const schema = direction === 'inputs' ? inputSchema(node, name) : outputSchema(node, name);
    return definition ?? { name, dataType: workflowPortDataType(schema) };
  }

  function portSchema(schema: JsonSchema | undefined, port: string): JsonSchema | undefined {
    const properties = schema?.properties;
    const value = properties && typeof properties === 'object' && !Array.isArray(properties)
      ? (properties as Record<string, unknown>)[port]
      : undefined;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonSchema : undefined;
  }

  function schemaPorts(schema: JsonSchema | undefined): string[] {
    const properties = schema?.properties;
    return properties && typeof properties === 'object' && !Array.isArray(properties) ? Object.keys(properties) : [];
  }

  function portDefinitions(schema: JsonSchema, inputs: boolean): WorkflowGraphPortDefinition[] {
    const required = new Set(inputs && Array.isArray(schema.required) ? schema.required : []);
    return schemaPorts(schema).map((name) => ({ name, dataType: workflowPortDataType(portSchema(schema, name)), required: required.has(name) }));
  }

  function outputPortDefinitions(schema: JsonSchema): WorkflowGraphPortDefinition[] {
    const ports = portDefinitions(schema, false);
    return ports.length > 0 ? ports : [{ name: '$result', dataType: workflowPortDataType(schema) }];
  }

  function defaultConfiguration(task: TaskMeta): Record<string, unknown> {
    const properties = task.input_schema.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};
    return Object.fromEntries(Object.entries(properties as Record<string, unknown>)
      .filter(([, schema]) => !!schema && typeof schema === 'object' && Object.prototype.hasOwnProperty.call(schema, 'default'))
      .map(([key, schema]) => [key, (schema as Record<string, unknown>).default]));
  }

  function configValue(node: WorkflowGraphNode): string {
    return configText[node.id] ?? JSON.stringify(node.configuration ?? {}, null, 2);
  }

  function sourceKey(source: WorkflowGraphSource): string {
    return JSON.stringify(source);
  }

  function decodeSource(value: string): WorkflowGraphSource {
    return JSON.parse(value) as WorkflowGraphSource;
  }

  function isInputSource(source: WorkflowGraphSource, name?: string): source is { input: string } {
    return 'input' in source && (name === undefined || source.input === name);
  }

  function nextNodeId(taskName: string): string {
    const base = taskName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^\d+/, 'task') || 'task';
    let suffix = 1;
    while (graph.nodes.some((node: WorkflowGraphNode) => node.id === `${base}_${suffix}`)) suffix += 1;
    return `${base}_${suffix}`;
  }
</script>

<section class="graph-editor">
  <header class="graph-toolbar">
    <label><span>Add task</span><select bind:value={selectedTaskName} disabled={disabled || tasks.length === 0}>{#each tasks as task}<option value={task.name}>{task.label} — {task.name}</option>{/each}</select></label>
    <button type="button" class="secondary-button" onclick={addNode} disabled={disabled || !selectedTaskName}>Add task node</button>
    <span>Bindings are selected explicitly after a task is added.</span>
  </header>

  <div class="workflow-lane">
    <article class="workflow-node input-node">
      <header><div><strong>Workflow input</strong><code>input</code></div><span class="fixed-badge">Start node</span></header>
      <div class="input-creator">
        <select bind:value={newInputType} disabled={disabled}>{#each INPUT_TYPES as type}<option value={type}>{type}</option>{/each}</select>
        <button type="button" class="secondary-button" onclick={addWorkflowInput} disabled={disabled}>Add field</button>
      </div>
      {#if (graph.inputs ?? []).length === 0}
        <p class="empty-hint">Add the fields that tasks will consume. Fields are never generated automatically.</p>
      {:else}
        <div class="input-fields">
          {#each graph.inputs ?? [] as input}
            <div class="input-field-header"><code>{input.name}</code><select aria-label={`Type for ${input.name}`} value={workflowPortDataType(input.schema)} onchange={(event) => updateWorkflowInputType(input.name, event.currentTarget.value as WorkflowPortDataType)} disabled={disabled}>{#each INPUT_TYPES as type}<option value={type}>{type}</option>{/each}</select><button type="button" class="icon-button" aria-label={`Remove ${input.name}`} onclick={() => removeWorkflowInput(input.name)} disabled={disabled}>×</button></div>
          {/each}
        </div>
        <WorkflowInputForm schema={workflowInputSchema} bind:value={inputValues} {disabled} />
      {/if}
    </article>

    {#each graph.nodes as node, nodeIndex}
      <span class="flow-arrow" aria-hidden="true">→</span>
      <article class="workflow-node" class:invalid-node={errors.some((error: GraphCompileError) => error.nodeId === node.id)}>
        <header><div><strong>{taskFor(node)?.label ?? node.name}</strong><code>{node.id}</code></div><button type="button" class="icon-button" aria-label={`Remove ${node.id}`} onclick={() => removeNode(node.id)} disabled={disabled}>×</button></header>
        <section class="field-group">
          <h4>Inputs</h4>
          {#each inputPorts(node) as port}
            {@const definition = portDefinition(node, 'inputs', port)}
            {@const options = sourceOptions(node, port)}
            {@const warning = bindingWarning(node, port)}
            <label class="binding-field" class:invalid={!!warning}>
              <span><code>{port}</code>{#if definition.required}<b>*</b>{/if}<small>{definition.dataType}</small></span>
              <select value={selectedSource(node.id, port)} onchange={(event) => bindSource(node, port, event.currentTarget.value)} disabled={disabled}>
                <option value="">Unbound</option>
                {#each options as option}<option value={sourceKey(option.source)}>{option.label}</option>{/each}
              </select>
              {#if warning}<em>{warning}</em>{/if}
            </label>
          {/each}
        </section>
        <section class="field-group outputs">
          <h4>Outputs · read-only</h4>
          {#each outputPorts(node) as port}
            {@const definition = portDefinition(node, 'outputs', port)}
            <div class="output-field"><code>{node.id}.{port}</code><span>{definition.dataType}</span></div>
          {/each}
        </section>
        <details><summary>Optional configuration</summary><textarea value={configValue(node)} rows="4" disabled={disabled} oninput={(event) => updateConfiguration(node, event.currentTarget.value)}></textarea>{#if configErrors[node.id]}<small class="error-text">{configErrors[node.id]}</small>{/if}</details>
      </article>
    {/each}
  </div>

  {#if errors.length > 0}<section class="graph-errors" aria-live="polite"><strong>Graph validation</strong><ul>{#each errors as error}<li>{error.message}</li>{/each}</ul></section>{/if}
</section>

<style>
  .graph-editor { display: grid; gap: 1rem; }
  .graph-toolbar, .input-creator { display: flex; flex-wrap: wrap; align-items: end; gap: .6rem; }
  .graph-toolbar label { display: grid; gap: .35rem; }
  .graph-toolbar label span { color: var(--text-muted); font-size: .78rem; font-weight: 650; }
  .graph-toolbar > span { align-self: center; color: var(--text-subtle); font-size: .78rem; }
  .workflow-lane { display: flex; align-items: flex-start; gap: .75rem; min-height: 390px; overflow-x: auto; padding: 1rem; border: 1px solid var(--border-input); border-radius: 14px; background: var(--bg-page); }
  .workflow-node { display: grid; flex: 0 0 300px; gap: .8rem; padding: .9rem; border: 1px solid var(--border-input); border-radius: 12px; background: var(--bg-input); box-shadow: 0 5px 16px rgba(20,24,30,.07); }
  .workflow-node.input-node { flex-basis: 340px; border-color: #6759d4; }
  .workflow-node.invalid-node { border-color: #c83a49; box-shadow: 0 0 0 2px rgba(202,51,66,.12); }
  .workflow-node > header, .input-field-header, .output-field { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
  .workflow-node > header > div { display: grid; gap: .18rem; min-width: 0; }
  .workflow-node header strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .9rem; }
  .workflow-node header code { color: var(--text-subtle); font-size: .7rem; }
  .fixed-badge { padding: .25rem .45rem; border-radius: 99px; background: rgba(105,91,255,.13); color: #5c50be; font-size: .68rem; font-weight: 700; }
  .flow-arrow { align-self: center; color: #6759d4; font-size: 1.4rem; }
  .empty-hint { margin: 0; color: var(--text-muted); font-size: .8rem; }
  .input-fields { display: grid; gap: .35rem; }
  .input-field-header { padding: .35rem; border: 1px solid var(--border-input); border-radius: 7px; background: var(--bg-page); }
  .input-field-header select { margin-left: auto; color: #5c50be; font-size: .72rem; }
  .field-group { display: grid; gap: .45rem; }
  .field-group h4 { margin: 0; color: var(--text-subtle); font-size: .67rem; letter-spacing: .06em; text-transform: uppercase; }
  .binding-field { display: grid; gap: .3rem; padding: .45rem; border: 1px solid var(--border-input); border-radius: 8px; background: var(--bg-page); }
  .binding-field.invalid { border-color: rgba(202,51,66,.7); }
  .binding-field > span { display: flex; align-items: center; gap: .3rem; }
  .binding-field b { color: #b52d3c; }
  .binding-field small, .output-field span { margin-left: auto; padding: .15rem .35rem; border-radius: 99px; background: var(--bg-badge-muted); color: #5c50be; font-size: .65rem; }
  .binding-field em { color: #b52d3c; font-size: .68rem; font-style: normal; }
  .binding-field select { width: 100%; font-family: monospace; font-size: .72rem; }
  .output-field { padding: .4rem .45rem; border: 1px solid var(--border-input); border-radius: 7px; background: var(--bg-page); font-size: .7rem; }
  .workflow-node details { color: var(--text-muted); font-size: .74rem; }
  .workflow-node summary { cursor: pointer; }
  .workflow-node textarea { width: 100%; box-sizing: border-box; margin-top: .45rem; resize: vertical; font-family: monospace; font-size: .72rem; }
  .icon-button { display: grid; flex: 0 0 26px; width: 26px; height: 26px; place-items: center; border: 1px solid var(--border-input); border-radius: 6px; background: transparent; color: var(--text-muted); }
  .error-text, .graph-errors { color: #b52d3c; }
  .graph-errors { padding: .8rem 1rem; border: 1px solid rgba(202,51,66,.35); border-radius: 10px; background: rgba(202,51,66,.07); }
  .graph-errors ul { margin: .45rem 0 0; padding-left: 1.25rem; }
</style>
