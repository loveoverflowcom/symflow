<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { language, t } from '$lib/i18n';
  import type { FlowNodeData } from '$lib/utils/flow-graph';

  let {
    data,
    selected = false,
    isSource = true,
    isTarget = true,
    accentColor = '#6366f1',
    icon = '⚙'
  } = $props<{
    data: FlowNodeData;
    selected?: boolean;
    isSource?: boolean;
    isTarget?: boolean;
    accentColor?: string;
    icon?: string;
  }>();
</script>

<div class:selected class="flow-node" style={`--node-accent: ${accentColor}`}>
  {#if isTarget}
    <Handle type="target" position={Position.Left} />
  {/if}

  <div class="node-header">
    <span class="node-icon" aria-hidden="true">{icon}</span>
    <span class="node-type">{data.stepType}</span>
  </div>
  <div class="node-body">
    <strong>{data.label}</strong>
    <span>{t($language, 'configFields', { count: Object.keys(data.config ?? {}).length })}</span>
  </div>

  {#if isSource}
    <Handle type="source" position={Position.Right} />
  {/if}
</div>

<style>
  .flow-node {
    min-width: 190px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--node-accent) 45%, #cbd0d7);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 10px 28px rgba(25, 30, 38, 0.1);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .flow-node.selected {
    border-color: var(--node-accent);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--node-accent) 17%, transparent),
      0 14px 32px rgba(25, 30, 38, 0.14);
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 11px;
    background: color-mix(in srgb, var(--node-accent) 12%, white);
    color: color-mix(in srgb, var(--node-accent) 82%, #20242a);
    font-size: 0.67rem;
    font-weight: 750;
    letter-spacing: 0.055em;
    text-transform: uppercase;
  }

  .node-icon {
    font-size: 0.85rem;
  }

  .node-body {
    display: grid;
    gap: 4px;
    padding: 12px;
  }

  .node-body strong {
    max-width: 210px;
    overflow: hidden;
    color: #202329;
    font-size: 0.82rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-body span {
    color: #8a9098;
    font-size: 0.7rem;
  }

  :global(.svelte-flow__handle) {
    width: 10px;
    height: 10px;
    border: 2px solid white;
    background: var(--node-accent);
  }
</style>
