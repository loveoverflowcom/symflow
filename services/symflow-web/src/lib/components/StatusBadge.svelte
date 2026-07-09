<script lang="ts">
  import { language, t } from '$lib/i18n';

  let { value } = $props<{ value: string }>();

  const toneByStatus: Record<string, string> = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'gumloop',
    COMPLETED: 'gumloop',
    FAILED: 'failed',
    SKIPPED: 'muted'
  };

  const tone = $derived(toneByStatus[value] ?? 'muted');
</script>

<span class={`badge ${tone}`}>{t($language, `status_${value}`)}</span>
