<script lang="ts">
  import type { ViewError } from '$lib/api/errors';
  import AppShell from '$lib/components/AppShell.svelte';
  import DownloadArtifacts from '$lib/components/DownloadArtifacts.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import JsonBlock from '$lib/components/JsonBlock.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { language, t } from '$lib/i18n';
  import type { FlowRun } from '$lib/types/symflow';
  import { formatDate } from '$lib/utils/format';

  let { data } = $props<{ data: { run: FlowRun | null; error: ViewError | null; runId: string } }>();
</script>

<svelte:head>
  <title>{t($language, 'runTitle', { id: data.run?.id ?? data.runId })} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  {#snippet actions()}
    <a class="secondary-button" href={data.run ? `/flows/${data.run.flow_id}` : '/flows'}>
      {data.run ? t($language, 'backToFlow') : t($language, 'backToFlows')}
    </a>
  {/snippet}

  {#if data.error}
    <InlineError error={{ ...data.error, title: t($language, 'unableLoadRun', { id: data.runId }) }} retryHref="/flows" />
  {:else if data.run}
    <div class="page-title-block">
      <h1>{t($language, 'runTitle', { id: data.run.id })}</h1>
      <p class="subtitle">Kết quả và task log được ghi từ TypeScript runtime trong browser.</p>
    </div>

    <section class="run-overview">
      <article class="card stack">
        <div class="row-between">
          <h2>{t($language, 'runStatus')}</h2>
          <StatusBadge value={data.run.status} />
        </div>
        <p><strong>{t($language, 'flow')}:</strong> <span class="mono">{data.run.flow_id}</span></p>
        <p><strong>{t($language, 'started')}:</strong> {formatDate(data.run.created_at)}</p>
        <p><strong>{t($language, 'finished')}:</strong> {formatDate(data.run.finished_at)}</p>
        {#if data.run.error}<p class="error-message">{data.run.error}</p>{/if}
        <JsonBlock label={t($language, 'initialInputs')} value={data.run.initial_inputs} />
        <JsonBlock label="Output" value={data.run.output} />
        <DownloadArtifacts value={data.run.output} />
      </article>

      <article class="card stack">
        <h2>Execution log</h2>
        {#if !data.run.execution_logs?.length}
          <p class="muted">{t($language, 'noLogEvents')}</p>
        {:else}
          {#each data.run.execution_logs as log}
            <section class="step-card">
              <div class="row-between">
                <strong>{log.name ?? log.type}</strong>
                <span class="muted">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              {#if log.error}<p class="error-message">{log.error}</p>{/if}
              {#if log.input !== undefined}<JsonBlock label="Input" value={log.input} />{/if}
              {#if log.output !== undefined}<JsonBlock label="Output" value={log.output} />{/if}
              {#if log.output !== undefined}<DownloadArtifacts value={log.output} />{/if}
            </section>
          {/each}
        {/if}
      </article>
    </section>
  {/if}
</AppShell>
