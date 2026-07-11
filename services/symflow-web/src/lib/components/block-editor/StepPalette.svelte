<script lang="ts">
  import type { TaskMeta } from '$lib/utils/dsl-tree';

  let { tasks, disabled = false, onAdd } = $props<{
    tasks: TaskMeta[];
    disabled?: boolean;
    onAdd: (task: TaskMeta) => void;
  }>();

  let selectedName = $state('');
  const selectedTask = $derived(tasks.find((task: TaskMeta) => task.name === selectedName));
</script>

<div class="step-palette">
  <select bind:value={selectedName} {disabled} aria-label="Task type">
    <option value="">Select a task…</option>
    {#each tasks as task}
      <option value={task.name}>{task.label}</option>
    {/each}
  </select>
  <button
    class="primary-button"
    type="button"
    disabled={disabled || !selectedTask}
    onclick={() => {
      if (!selectedTask) return;
      onAdd(selectedTask);
      selectedName = '';
    }}
  >
    ＋ Add step
  </button>
</div>

<style>
  .step-palette {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  select {
    min-width: min(280px, 55vw);
    border: 1px solid var(--border-input);
    border-radius: 10px;
    background: var(--bg-input);
    color: var(--text-primary);
    padding: 0.72rem 0.85rem;
  }

  @media (max-width: 600px) {
    .step-palette {
      align-items: stretch;
      flex-direction: column;
    }

    select {
      width: 100%;
    }
  }
</style>
