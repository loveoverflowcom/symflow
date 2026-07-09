<script lang="ts">
  import { onMount } from 'svelte';
  import type { ViewError } from '$lib/api/errors';
  import { getRun } from '$lib/api/client';
  import AppShell from '$lib/components/AppShell.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import JsonBlock from '$lib/components/JsonBlock.svelte';
  import ReactLogView from '$lib/components/ReactLogView.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { language, t } from '$lib/i18n';
  import type { AgentLogEvent, FlowRun, StepExecution } from '$lib/types/symflow';
  import { formatDate, normalizeLogEntries } from '$lib/utils/format';

  let { data } = $props<{ data: { run: FlowRun | null; error: ViewError | null; runId: string } }>();

  let initialized = $state(false);
  let run = $state<FlowRun>({
    id: '',
    flow_id: '',
    status: 'PENDING',
    created_at: '',
    steps: []
  });

  const terminalStatuses = new Set(['SUCCESS', 'FAILED']);

  const initialLogs = $derived(
    (run.steps ?? []).flatMap((step: StepExecution): AgentLogEvent[] => normalizeLogEntries(step.agent_logs))
  );

  $effect(() => {
    if (initialized) return;
    if (data.run) {
      run = data.run;
    }
    initialized = true;
  });

  onMount(() => {
    if (!data.run) {
      return;
    }

    if (terminalStatuses.has(run.status)) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const nextRun = await getRun(run.id);
        run = nextRun;

        if (terminalStatuses.has(nextRun.status)) {
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  });
</script>

<svelte:head>
  <title>{t($language, 'runTitle', { id: data.run ? run.id : data.runId })} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  {#snippet actions()}
    {#if data.run}
      <a class="secondary-button" href={`/flows/${run.flow_id}`}>{t($language, 'backToFlow')}</a>
    {:else}
      <a class="secondary-button" href="/flows">{t($language, 'backToFlows')}</a>
    {/if}
  {/snippet}

  <div class="page-title-block">
    <h1>{data.run ? t($language, 'runTitle', { id: run.id }) : t($language, 'runDetail')}</h1>
    <p class="subtitle">{t($language, 'runSubtitle')}</p>
  </div>

  {#if data.error}
    <InlineError error={{ ...data.error, title: t($language, 'unableLoadRun', { id: data.runId }) }} retryHref="/flows" />
  {:else}
    <section class="run-overview">
    <article class="card stack">
      <div class="row-between">
        <h2>{t($language, 'runStatus')}</h2>
        <StatusBadge value={run.status} />
      </div>
      <p><strong>{t($language, 'flow')}:</strong> <span class="mono">{run.flow_id}</span></p>
      <p><strong>{t($language, 'started')}:</strong> {formatDate(run.created_at)}</p>
      <p><strong>{t($language, 'finished')}:</strong> {formatDate(run.finished_at)}</p>
      <JsonBlock label={t($language, 'initialInputs')} value={run.initial_inputs} />
    </article>

    <article class="card stack">
      <div class="row-between">
        <h2>{t($language, 'steps')}</h2>
        <span class="muted">{t($language, 'total', { count: run.steps?.length ?? 0 })}</span>
      </div>

      {#if !run.steps || run.steps.length === 0}
        <p class="muted">{t($language, 'noStepData')}</p>
      {:else}
        <div class="stack">
          {#each run.steps as step}
            <section class="step-card">
              <div class="row-between">
                <div>
                  <h3>{step.step_id}</h3>
                  <p class="muted">{formatDate(step.executed_at)}</p>
                </div>
                <StatusBadge value={step.status} />
              </div>

              {#if step.error}
                <p class="error-message">{step.error}</p>
              {/if}

              <div class="two-column">
                <JsonBlock label={t($language, 'resolvedInputs')} value={step.resolved_inputs} />
                <JsonBlock label={t($language, 'outputs')} value={step.outputs} />
              </div>
            </section>
          {/each}
        </div>
      {/if}
    </article>
    </section>

    <ReactLogView runId={run.id} {initialLogs} />
  {/if}
</AppShell>
