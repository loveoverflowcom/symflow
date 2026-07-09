<script lang="ts">
  import { page } from '$app/state';
  import AppShell from '$lib/components/AppShell.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import { language, t } from '$lib/i18n';
</script>

<AppShell>
  {#snippet actions()}
    <a class="secondary-button" href="/flows">{t($language, 'backToFlows')}</a>
  {/snippet}

  <div class="page-title-block">
    <h1>{t($language, 'somethingWrong')}</h1>
    <p class="subtitle">{t($language, 'requestedViewUnavailable')}</p>
  </div>

  <InlineError
    error={{
      title: page.status === 404 ? t($language, 'pageNotFound') : t($language, 'unableRenderView'),
      message: page.error?.message ?? t($language, 'unexpectedClientError'),
      status: page.status
    }}
    retryHref="/flows"
  />
</AppShell>
