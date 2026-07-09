<script lang="ts">
  import { untrack } from 'svelte';
  import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    SvelteFlow,
    useSvelteFlow,
    type Connection,
    type Edge,
    type NodeTypes
  } from '@xyflow/svelte';
  import { language, t } from '$lib/i18n';
  import {
    dslToGraph,
    graphToDsl,
    mapStepTypeToNodeType,
    type DslFlow,
    type FlowNode
  } from '$lib/utils/flow-graph';
  import NodeConfigPanel from './NodeConfigPanel.svelte';
  import NodePalette from './NodePalette.svelte';
  import AgentNode from './nodes/AgentNode.svelte';
  import LocalFileReaderNode from './nodes/LocalFileReaderNode.svelte';
  import ManualTriggerNode from './nodes/ManualTriggerNode.svelte';
  import WebScraperNode from './nodes/WebScraperNode.svelte';

  let {
    dsl,
    flowId,
    flowName,
    disabled = false,
    onDslChange
  } = $props<{
    dsl: DslFlow;
    flowId: string;
    flowName: string;
    disabled?: boolean;
    onDslChange: (newDsl: DslFlow) => void;
  }>();

  const initialGraph = untrack(() => dslToGraph(dsl));
  let nodes = $state.raw<FlowNode[]>(initialGraph.nodes);
  let edges = $state.raw<Edge[]>(initialGraph.edges);
  let selectedNode = $state<FlowNode | null>(null);
  let emitQueued = false;

  const { screenToFlowPosition } = useSvelteFlow<FlowNode, Edge>();
  const nodeTypes: NodeTypes = {
    manualTrigger: ManualTriggerNode,
    webScraper: WebScraperNode,
    localFileReader: LocalFileReaderNode,
    agentNode: AgentNode
  };

  $effect(() => {
    flowId;
    flowName;
    scheduleEmit();
  });

  function emitDsl() {
    onDslChange(graphToDsl(flowId, flowName, nodes, edges));
  }

  function scheduleEmit() {
    if (emitQueued) return;
    emitQueued = true;
    queueMicrotask(() => {
      emitQueued = false;
      emitDsl();
    });
  }

  function uniqueNodeId(stepType: string): string {
    const base = stepType === 'agent' ? 'agent' : stepType;
    const existing = new Set(nodes.map((node) => node.id));
    let index = 1;
    let candidate = `${base}_${index}`;

    while (existing.has(candidate)) {
      index += 1;
      candidate = `${base}_${index}`;
    }
    return candidate;
  }

  function addNode(stepType: string, position?: { x: number; y: number }) {
    if (disabled) return;
    const id = uniqueNodeId(stepType);
    const fallbackIndex = nodes.length;
    const nextNode: FlowNode = {
      id,
      type: mapStepTypeToNodeType(stepType),
      position: position ?? {
        x: 80 + (fallbackIndex % 3) * 230,
        y: 80 + Math.floor(fallbackIndex / 3) * 170
      },
      data: {
        label: id,
        stepType,
        config: {}
      }
    };

    nodes = [...nodes, nextNode];
    selectedNode = nextNode;
    emitDsl();
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    const stepType = event.dataTransfer?.getData('application/symflow-node-type');
    if (!stepType || disabled) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });
    addNode(stepType, {
      x: position.x - 95,
      y: position.y - 35
    });
  }

  function prepareConnection(connection: Connection): Edge | false {
    if (disabled) return false;
    return {
      ...connection,
      id: `${connection.source}->${connection.target}`,
      type: 'smoothstep',
      animated: true
    };
  }

  function handleConfigUpdate(nodeId: string, config: Record<string, unknown>) {
    nodes = nodes.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, config } } : node
    );
    selectedNode = nodes.find((node) => node.id === nodeId) ?? null;
    emitDsl();
  }

  function handleDelete() {
    if (selectedNode && !nodes.some((node) => node.id === selectedNode?.id)) {
      selectedNode = null;
    }
    scheduleEmit();
  }
</script>

<div class="canvas-wrapper" aria-label={t($language, 'flowCanvas')}>
  <NodePalette {disabled} onAdd={addNode} />

  <div
    class="flow-area"
    role="application"
    aria-label={t($language, 'flowCanvas')}
    ondrop={handleDrop}
    ondragover={(event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }}
  >
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.28, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={1.6}
      nodesDraggable={!disabled}
      nodesConnectable={!disabled}
      deleteKey={disabled ? null : ['Backspace', 'Delete']}
      onnodeclick={({ node }) => (selectedNode = node)}
      onnodedragstop={scheduleEmit}
      onbeforeconnect={prepareConnection}
      onconnect={scheduleEmit}
      ondelete={handleDelete}
      onpaneclick={() => (selectedNode = null)}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} patternColor="#cdd2d8" />
      <Controls showLock={false} />
      <MiniMap pannable zoomable />
    </SvelteFlow>

    {#if nodes.length === 0}
      <div class="canvas-empty">
        <span aria-hidden="true">＋</span>
        <strong>{t($language, 'emptyCanvas')}</strong>
        <p>{t($language, 'emptyCanvasDescription')}</p>
      </div>
    {/if}
  </div>

  <NodeConfigPanel
    node={selectedNode}
    {disabled}
    onUpdate={handleConfigUpdate}
    onClose={() => (selectedNode = null)}
  />
</div>

<style>
  .canvas-wrapper {
    position: relative;
    display: flex;
    height: 100%;
    min-height: 0;
    background: #f8f9fa;
  }

  .flow-area {
    position: relative;
    min-width: 0;
    flex: 1;
  }

  .canvas-empty {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    display: grid;
    max-width: 270px;
    place-items: center;
    transform: translate(-50%, -50%);
    color: #8a919a;
    text-align: center;
    pointer-events: none;
  }

  .canvas-empty > span {
    display: grid;
    width: 42px;
    height: 42px;
    margin-bottom: 11px;
    place-items: center;
    border: 1px dashed #afb5bd;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.75);
    font-size: 1.3rem;
  }

  .canvas-empty strong {
    color: #5e656e;
    font-size: 0.85rem;
  }

  .canvas-empty p {
    margin-top: 5px;
    font-size: 0.72rem;
    line-height: 1.45;
  }

  :global(.svelte-flow) {
    --xy-background-color: #f8f9fa;
    --xy-edge-stroke: #98a1ad;
    --xy-edge-stroke-selected: #168eea;
    --xy-connectionline-stroke: #168eea;
  }

  :global(.svelte-flow__controls) {
    overflow: hidden;
    border: 1px solid #d9dde2;
    border-radius: 9px;
    box-shadow: 0 5px 15px rgba(25, 30, 38, 0.08);
  }

  :global(.svelte-flow__controls-button) {
    border-bottom-color: #e2e5e8;
    background: rgba(255, 255, 255, 0.95);
    fill: #535a63;
  }

  :global(.svelte-flow__minimap) {
    overflow: hidden;
    border: 1px solid #d9dde2;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 5px 15px rgba(25, 30, 38, 0.06);
  }

  :global(.svelte-flow__edge-path) {
    stroke-width: 1.6;
  }
</style>
