<script lang="ts">
  import { onMount } from 'svelte';
  import {
    appendSequentialStep,
    defaultTaskConfig,
    reorderSteps,
    uniqueStepId,
    type DslFlow,
    type DslStep,
    type TaskMeta
  } from '$lib/utils/dsl-tree';
  import { taskCatalog } from '$lib/runtime';
  import StepBlock from './StepBlock.svelte';
  import StepConfigPanel from './StepConfigPanel.svelte';
  import StepPalette from './StepPalette.svelte';

  let {
    dsl,
    flowId,
    flowName,
    disabled = false,
    onDslChange
  } = $props<{
    dsl: DslFlow;
    flowId: string;
    flowName: string;
    disabled?: boolean;
    onDslChange: (newDsl: DslFlow) => void;
  }>();

  let tasks = $state<TaskMeta[]>([]);
  let loadError = $state('');
  let selectedId = $state<string | null>(null);
  let draggedIndex = $state<number | null>(null);
  const selectedStep = $derived(
    dsl.steps.find((step: DslStep) => step.id === selectedId) ?? null
  );

  onMount(async () => {
    try {
      tasks = (await taskCatalog()) as unknown as TaskMeta[];
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Unable to load tasks';
    }
  });

  function emit(steps: DslStep[]) {
    onDslChange({
      ...dsl,
      flow_id: flowId,
      name: flowName,
      steps
    });
  }

  function addStep(task: TaskMeta) {
    const step: DslStep = {
      id: uniqueStepId(task.name, dsl.steps),
      type: task.name,
      with: defaultTaskConfig(task)
    };
    const steps = appendSequentialStep(dsl.steps, step);
    emit(steps);
    selectedId = step.id;
  }

  function updateStep(updated: DslStep) {
    if (!selectedStep) return;
    const oldId = selectedStep.id;
    const steps = dsl.steps.map((step: DslStep) => {
      if (step.id === oldId) return updated;
      if (oldId !== updated.id && step.needs?.includes(oldId)) {
        return {
          ...step,
          needs: step.needs.map((dependency: string) =>
            dependency === oldId ? updated.id : dependency
          )
        };
      }
      return step;
    });
    selectedId = updated.id;
    emit(steps);
  }

  function deleteStep(index: number) {
    const removed = dsl.steps[index];
    const previousId = index > 0 ? dsl.steps[index - 1].id : null;
    const steps = dsl.steps
      .filter((_step: DslStep, candidateIndex: number) => candidateIndex !== index)
      .map((step: DslStep) => ({
        ...step,
        needs: step.needs
          ?.flatMap((dependency: string) =>
            dependency === removed.id ? (previousId ? [previousId] : []) : [dependency]
          )
          .filter(
            (dependency: string, dependencyIndex: number, all: string[]) =>
              all.indexOf(dependency) === dependencyIndex
          )
      }));
    if (selectedId === removed.id) selectedId = null;
    emit(steps);
  }

  function dropAt(index: number) {
    if (draggedIndex === null) return;
    emit(reorderSteps(dsl.steps, draggedIndex, index));
    draggedIndex = null;
  }
</script>

<div class="block-editor">
  <div class="block-toolbar">
    <StepPalette {tasks} {disabled} onAdd={addStep} />
    {#if loadError}<span class="error-message">{loadError}</span>{/if}
  </div>

  <div class:with-config={selectedStep} class="block-workspace">
    <div class="step-list">
      {#if dsl.steps.length === 0}
        <div class="empty-blocks">
          <strong>No steps yet</strong>
          <span>Select a task above to build the workflow.</span>
        </div>
      {:else}
        {#each dsl.steps as step, index (step.id)}
          <StepBlock
            {step}
            {index}
            label={tasks.find((task) => task.name === step.type)?.label ?? step.type}
            {disabled}
            selected={selectedId === step.id}
            onSelect={() => (selectedId = step.id)}
            onDelete={() => deleteStep(index)}
            onDragStart={(sourceIndex) => (draggedIndex = sourceIndex)}
            onDrop={dropAt}
          />
        {/each}
      {/if}
    </div>

    {#if selectedStep}
      <StepConfigPanel
        step={selectedStep}
        {tasks}
        {disabled}
        onChange={updateStep}
        onClose={() => (selectedId = null)}
      />
    {/if}
  </div>
</div>

<style>
  .block-editor {
    display: grid;
    gap: 1rem;
    min-height: 100%;
  }

  .block-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .block-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 1rem;
  }

  .block-workspace.with-config {
    grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  }

  .step-list {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }

  .empty-blocks {
    display: grid;
    min-height: 280px;
    place-content: center;
    gap: 0.4rem;
    border: 1px dashed var(--border-input);
    border-radius: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  @media (max-width: 900px) {
    .block-workspace.with-config {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 600px) {
    .block-toolbar {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
