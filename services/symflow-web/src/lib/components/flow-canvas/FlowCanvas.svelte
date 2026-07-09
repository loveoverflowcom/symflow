<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import type { DslFlow } from '$lib/utils/flow-graph';
  import FlowCanvasViewport from './FlowCanvasViewport.svelte';

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
</script>

<SvelteFlowProvider>
  <FlowCanvasViewport {dsl} {flowId} {flowName} {disabled} {onDslChange} />
</SvelteFlowProvider>
