<script lang="ts">
  import { taskAlias } from '@symflow/runtime';
  import type { TaskMeta } from '@symflow/runtime';
  import JsonBlock from '$lib/components/JsonBlock.svelte';

  let { tasks = [] as TaskMeta[], loading = false } = $props<{
    tasks?: TaskMeta[];
    loading?: boolean;
  }>();

  let query = $state('');
  let selectedName = $state('');
  let copied = $state(false);

  const filteredTasks = $derived(
    tasks.filter((task: TaskMeta) => {
      const needle = query.trim().toLowerCase();
      return (
        !needle ||
        task.name.toLowerCase().includes(needle) ||
        task.label.toLowerCase().includes(needle) ||
        task.description.toLowerCase().includes(needle) ||
        task.category.toLowerCase().includes(needle)
      );
    })
  );
  const selectedTask = $derived(
    tasks.find((task: TaskMeta) => task.name === selectedName) ?? tasks[0]
  );
  const importSnippet = $derived(
    selectedTask
      ? `import { ${taskAlias(selectedTask.name)} } from '@symflow/runtime';`
      : ''
  );

  $effect(() => {
    if (!selectedName && tasks.length > 0) selectedName = tasks[0].name;
  });

  async function copyImport() {
    if (!importSnippet) return;
    await navigator.clipboard.writeText(importSnippet);
    copied = true;
    window.setTimeout(() => (copied = false), 1400);
  }
</script>

<section class="task-catalog">
  <aside class="task-list-panel">
    <div class="task-list-heading">
      <div>
        <h2>Task Registry</h2>
        <p>{tasks.length} tasks available</p>
      </div>
      <input bind:value={query} type="search" placeholder="Search tasks…" aria-label="Search tasks" />
    </div>

    {#if loading}
      <p class="empty-state">Loading task registry…</p>
    {:else if filteredTasks.length === 0}
      <p class="empty-state">No task matches “{query}”.</p>
    {:else}
      <nav class="task-list" aria-label="Task registry">
        {#each filteredTasks as task}
          <button
            type="button"
            class:active={selectedTask?.name === task.name}
            onclick={() => {
              selectedName = task.name;
              copied = false;
            }}
          >
            <span class="task-icon">{taskAlias(task.name).slice(0, 2).toUpperCase()}</span>
            <span class="task-summary">
              <strong>{task.label}</strong>
              <span>{task.name}</span>
            </span>
            <span class="runtime-dot" class:local={task.runtime === 'local'} title={task.runtime}></span>
          </button>
        {/each}
      </nav>
    {/if}
  </aside>

  <article class="task-detail">
    {#if selectedTask}
      <header class="task-detail-header">
        <div>
          <div class="badges">
            <span>{selectedTask.category}</span>
            <span class:local-badge={selectedTask.runtime === 'local'}>{selectedTask.runtime}</span>
          </div>
          <h2>{selectedTask.label}</h2>
          <code>{selectedTask.name}</code>
        </div>
      </header>

      <p class="description">{selectedTask.description}</p>

      <section class="import-card">
        <div class="row-between">
          <h3>Import</h3>
          <button type="button" class="copy-button" onclick={copyImport}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre><code>{importSnippet}</code></pre>
      </section>

      <div class="schema-grid">
        <JsonBlock label="Input schema" value={selectedTask.input_schema} />
        <JsonBlock label="Output schema" value={selectedTask.output_schema} />
      </div>
    {:else if !loading}
      <p class="empty-state">Task registry is empty.</p>
    {/if}
  </article>
</section>

<style>
  .task-catalog {
    display: grid;
    min-height: 610px;
    grid-template-columns: minmax(260px, 0.36fr) minmax(0, 0.64fr);
    overflow: hidden;
    border: 1px solid var(--border-input);
    border-radius: 14px;
    background: var(--bg-input);
  }

  .task-list-panel {
    border-right: 1px solid var(--border-input);
    background: var(--bg-page);
  }

  .task-list-heading {
    display: grid;
    gap: 14px;
    padding: 20px;
    border-bottom: 1px solid var(--border-input);
  }

  .task-list-heading h2 {
    font-size: 1rem;
  }

  .task-list-heading p {
    margin-top: 3px;
    color: var(--text-subtle);
    font-size: 0.78rem;
  }

  .task-list-heading input {
    width: 100%;
  }

  .task-list {
    display: grid;
    max-height: 520px;
    overflow-y: auto;
    padding: 8px;
  }

  .task-list button {
    display: grid;
    width: 100%;
    grid-template-columns: 38px minmax(0, 1fr) 8px;
    align-items: center;
    gap: 11px;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 10px;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
  }

  .task-list button:hover {
    background: var(--bg-badge-muted);
  }

  .task-list button.active {
    border-color: var(--border-input);
    background: var(--bg-input);
    box-shadow: 0 1px 5px rgba(20, 24, 30, 0.06);
  }

  .task-icon {
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: 10px;
    background: rgba(105, 91, 255, 0.11);
    color: #6759d4;
    font-size: 0.72rem;
    font-weight: 750;
  }

  .task-summary {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .task-summary strong,
  .task-summary span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-summary strong {
    font-size: 0.88rem;
  }

  .task-summary span {
    color: var(--text-subtle);
    font-family: monospace;
    font-size: 0.72rem;
  }

  .runtime-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4d8fe4;
  }

  .runtime-dot.local {
    background: #38a169;
  }

  .task-detail {
    min-width: 0;
    padding: clamp(24px, 4vw, 42px);
  }

  .task-detail-header h2 {
    margin: 12px 0 5px;
    font-size: 1.55rem;
  }

  .task-detail-header code {
    color: var(--text-subtle);
    font-size: 0.82rem;
  }

  .badges {
    display: flex;
    gap: 7px;
  }

  .badges span {
    border-radius: 99px;
    padding: 4px 9px;
    background: rgba(77, 143, 228, 0.12);
    color: #3976be;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .badges span.local-badge {
    background: rgba(56, 161, 105, 0.12);
    color: #298357;
  }

  .description {
    max-width: 720px;
    margin: 20px 0 24px;
    color: var(--text-muted);
    line-height: 1.65;
  }

  .import-card {
    display: grid;
    gap: 10px;
    margin-bottom: 28px;
  }

  .import-card h3 {
    font-size: 0.82rem;
  }

  .import-card pre {
    overflow-x: auto;
    border-radius: 10px;
    padding: 14px 16px;
    background: #171a21;
    color: #d9e2f2;
  }

  .copy-button {
    border: 1px solid var(--border-input);
    border-radius: 7px;
    padding: 5px 9px;
    background: var(--bg-page);
    color: var(--text-muted);
    font-size: 0.72rem;
  }

  .schema-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .schema-grid :global(pre) {
    max-height: 340px;
    overflow: auto;
  }

  .empty-state {
    padding: 24px;
    color: var(--text-subtle);
  }

  @media (max-width: 780px) {
    .task-catalog,
    .schema-grid {
      grid-template-columns: 1fr;
    }

    .task-list-panel {
      border-right: 0;
      border-bottom: 1px solid var(--border-input);
    }

    .task-list {
      max-height: 280px;
    }
  }
</style>
