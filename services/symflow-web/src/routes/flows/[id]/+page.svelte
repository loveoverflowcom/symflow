<script lang="ts">
  import type { ViewError } from '$lib/api/errors';
  import AppShell from '$lib/components/AppShell.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import { language, t } from '$lib/i18n';
  import FlowEditorPage from '../shared-editor.svelte';
  import type { FlowDetail } from '$lib/types/symflow';

  let { data } = $props<{ data: { flow: FlowDetail | null; error: ViewError | null; flowId: string } }>();
</script>

{#if data.flow}
  <FlowEditorPage flow={data.flow} />
{:else if data.error}
  <AppShell>
    {#snippet actions()}
      <a class="secondary-button" href="/flows">{t($language, 'backToFlows')}</a>
    {/snippet}

    <div class="page-title-block">
      <h1>{t($language, 'editFlow')}</h1>
      <p class="subtitle">{t($language, 'editFlowUnavailable')}</p>
    </div>
    <InlineError error={{ ...data.error, title: t($language, 'unableLoadFlow', { id: data.flowId }) }} retryHref="/flows" />
  </AppShell>
{/if}
