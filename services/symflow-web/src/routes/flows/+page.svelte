<script lang="ts">
  import type { ViewError } from '$lib/api/errors';
  import AppShell from '$lib/components/AppShell.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import { language, t } from '$lib/i18n';
  import { formatDate } from '$lib/utils/format';
  import type { FlowSummary } from '$lib/types/symflow';

  let { data } = $props<{ data: { flows: FlowSummary[]; error: ViewError | null } }>();
</script>

<svelte:head>
  <title>{t($language, 'flowsTitle')} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  {#snippet actions()}
    <a class="primary-button" href="/flows/new">{t($language, 'newFlow')}</a>
  {/snippet}

  <div class="page-title-block">
    <h1>{t($language, 'flowsTitle')}</h1>
    <p class="subtitle">{t($language, 'flowsSubtitle')}</p>
  </div>

  {#if data.error}
    <InlineError error={{ ...data.error, title: t($language, 'unableLoadFlows') }} retryHref="/flows" />
  {:else if data.flows.length === 0}
    <section class="card empty-state">
      <h2>{t($language, 'noFlowsYet')}</h2>
      <p class="muted">{t($language, 'noFlowsDescription')}</p>
    </section>
  {:else}
    <section class="grid">
      {#each data.flows as flow}
        <a class="card flow-card" href={`/flows/${flow.id}`}>
          <div class="stack-sm">
            <h2>{flow.name}</h2>
            <p class="mono">{flow.id}</p>
            <p class="muted">{t($language, 'created', { date: formatDate(flow.created_at) })}</p>
          </div>
        </a>
      {/each}
    </section>
  {/if}
</AppShell>
