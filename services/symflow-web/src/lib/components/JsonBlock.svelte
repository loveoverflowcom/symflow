<script lang="ts">
  import { language, t } from '$lib/i18n';
  import { prettyJson } from '$lib/utils/format';

  let { label, value } = $props<{ label: string; value: unknown }>();
</script>

<section class="stack-sm">
  <h3>{label}</h3>
  {#if value === undefined || value === null || prettyJson(value) === ''}
    <p class="muted">{t($language, 'noData')}</p>
  {:else}
    <pre>{prettyJson(value)}</pre>
  {/if}
</section>
