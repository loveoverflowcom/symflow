<script lang="ts">
  let { value } = $props<{ value: string }>();

  const toneByStatus: Record<string, string> = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    COMPLETED: 'success',
    FAILED: 'failed',
    SKIPPED: 'muted'
  };

  const tone = $derived(toneByStatus[value] ?? 'muted');
</script>

<span class={`badge ${tone}`}>{value}</span>
