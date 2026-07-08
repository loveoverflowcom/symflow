<script lang="ts">
  import FlowEditorPage from '../shared-editor.svelte';
  import type { FlowDetail } from '$lib/types/symflow';

  let { data } = $props<{ data: { flow: FlowDetail } }>();
</script>

<FlowEditorPage flow={data.flow} />
