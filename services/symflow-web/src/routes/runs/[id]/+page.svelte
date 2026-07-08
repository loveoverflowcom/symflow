<script lang="ts">
  import { onMount } from 'svelte';
  import { getRun } from '$lib/api/client';
  import AppShell from '$lib/components/AppShell.svelte';
  import JsonBlock from '$lib/components/JsonBlock.svelte';
  import ReactLogView from '$lib/components/ReactLogView.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import type { AgentLogEvent, FlowRun, StepExecution } from '$lib/types/symflow';
  import { formatDate, normalizeLogEntries } from '$lib/utils/format';

  let { data } = $props<{ data: { run: FlowRun } }>();

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
    run = data.run;
    initialized = true;
  });

  onMount(() => {
    if (terminalStatuses.has(run.status)) {
      return;
    }

    const timer = window.setInterval(async () => {
      const nextRun = await getRun(run.id);
      run = nextRun;

      if (terminalStatuses.has(nextRun.status)) {
        window.clearInterval(timer);
      }
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  });
</script>

<svelte:head>
  <title>Run {run.id} | Symflow</title>
</svelte:head>

<AppShell title={`Run ${run.id}`} subtitle="Watch step status and live ReAct logs for the current flow execution.">
  {#snippet actions()}
    <a class="secondary-button" href={`/flows/${run.flow_id}`}>Back to flow</a>
  {/snippet}

  <section class="run-overview">
    <article class="card stack">
      <div class="row-between">
        <h2>Run status</h2>
        <StatusBadge value={run.status} />
      </div>
      <p><strong>Flow:</strong> <span class="mono">{run.flow_id}</span></p>
      <p><strong>Started:</strong> {formatDate(run.created_at)}</p>
      <p><strong>Finished:</strong> {formatDate(run.finished_at)}</p>
      <JsonBlock label="Initial inputs" value={run.initial_inputs} />
    </article>

    <article class="card stack">
      <div class="row-between">
        <h2>Steps</h2>
        <span class="muted">{run.steps?.length ?? 0} total</span>
      </div>

      {#if !run.steps || run.steps.length === 0}
        <p class="muted">No step execution data yet.</p>
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
                <JsonBlock label="Resolved inputs" value={step.resolved_inputs} />
                <JsonBlock label="Outputs" value={step.outputs} />
              </div>
            </section>
          {/each}
        </div>
      {/if}
    </article>
  </section>

  <ReactLogView runId={run.id} {initialLogs} />
</AppShell>
