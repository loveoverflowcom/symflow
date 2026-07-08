<script lang="ts">
  import { prettyJson } from '$lib/utils/format';

  let { label, value } = $props<{ label: string; value: unknown }>();
</script>

<section class="stack-sm">
  <h3>{label}</h3>
  {#if value === undefined || value === null || prettyJson(value) === ''}
    <p class="muted">No data</p>
  {:else}
    <pre>{prettyJson(value)}</pre>
  {/if}
</section>
