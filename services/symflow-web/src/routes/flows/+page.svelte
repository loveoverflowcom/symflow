<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
  import { formatDate } from '$lib/utils/format';
  import type { FlowSummary } from '$lib/types/symflow';

  let { data } = $props<{ data: { flows: FlowSummary[] } }>();
</script>

<svelte:head>
  <title>Flows | Symflow</title>
</svelte:head>

<AppShell title="Flows" subtitle="Manage flow definitions and jump into editing or execution.">
  {#snippet actions()}
    <a class="primary-button" href="/flows/new">New flow</a>
  {/snippet}

  {#if data.flows.length === 0}
    <section class="card empty-state">
      <h2>No flows yet</h2>
      <p class="muted">Create the first flow to start authoring the YAML DSL and trigger runs.</p>
    </section>
  {:else}
    <section class="grid">
      {#each data.flows as flow}
        <a class="card flow-card" href={`/flows/${flow.id}`}>
          <div class="stack-sm">
            <h2>{flow.name}</h2>
            <p class="mono">{flow.id}</p>
            <p class="muted">Created {formatDate(flow.created_at)}</p>
          </div>
        </a>
      {/each}
    </section>
  {/if}
</AppShell>
