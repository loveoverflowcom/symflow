<script lang="ts">
  import type { ViewError } from '$lib/api/errors';
  import { language, t } from '$lib/i18n';

  let { error, retryHref = '' } = $props<{
    error: ViewError;
    retryHref?: string;
  }>();
</script>

<section class="card error-panel">
  <div class="stack-sm">
    <p class="eyebrow">{t($language, 'apiError')}{error.status ? ` ${error.status}` : ''}</p>
    <h2>{error.title}</h2>
    <p class="muted">{error.message}</p>
  </div>

  {#if retryHref}
    <a class="secondary-button" href={retryHref}>{t($language, 'retry')}</a>
  {/if}
</section>
