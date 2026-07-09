<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import type { FlowNode } from '$lib/utils/flow-graph';
  import BaseNode from './BaseNode.svelte';

  let { data, selected }: NodeProps<FlowNode> = $props();
</script>

<BaseNode {data} {selected} accentColor="#8755db" icon="✦" />
