<script lang="ts">
  import {
    configSummary,
    nestedStepGroups,
    type DslStep
  } from '$lib/utils/dsl-tree';

  let {
    step,
    index,
    label,
    disabled = false,
    selected = false,
    onSelect,
    onDelete,
    onDragStart,
    onDrop
  } = $props<{
    step: DslStep;
    index: number;
    label: string;
    disabled?: boolean;
    selected?: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onDragStart: (index: number) => void;
    onDrop: (index: number) => void;
  }>();

  const summary = $derived(configSummary(step));
  const groups = $derived(nestedStepGroups(step));
</script>

<article
  class:selected
  class="step-block"
  draggable={!disabled}
  ondragstart={() => onDragStart(index)}
  ondragover={(event) => event.preventDefault()}
  ondrop={(event) => {
    event.preventDefault();
    onDrop(index);
  }}
>
  <button class="drag-handle" type="button" disabled={disabled} aria-label="Reorder step">⋮⋮</button>
  <span class="step-index">{index + 1}</span>
  <div class="step-copy">
    <div class="step-heading">
      <strong>{label}</strong>
      <code>{step.id}</code>
      <span class="type-badge">{step.type}</span>
    </div>
    {#if summary}<p>{summary}</p>{/if}

    {#if groups.some((group) => group.steps.length > 0)}
      <div class="nested-groups">
        {#each groups as group}
          {#if group.steps.length > 0}
            <div class="nested-group">
              <span>{group.label}</span>
              {#each group.steps as child, childIndex}
                <div class="nested-step">
                  <span>{childIndex + 1}</span>
                  <strong>{child.type}</strong>
                  <code>{child.id}</code>
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
  <div class="step-actions">
    <button class="secondary-button compact-action" type="button" disabled={disabled} onclick={onSelect}>
      Configure
    </button>
    <button class="delete-action" type="button" disabled={disabled} onclick={onDelete} aria-label="Delete step">
      ×
    </button>
  </div>
</article>

<style>
  .step-block {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
    border: 1px solid var(--border-card);
    border-radius: 12px;
    background: var(--bg-input);
    padding: 0.9rem;
  }

  .step-block.selected {
    border-color: #159deb;
    box-shadow: 0 0 0 3px rgba(21, 157, 235, 0.1);
  }

  .drag-handle,
  .delete-action {
    min-width: 30px;
    min-height: 30px;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
  }

  .drag-handle {
    cursor: grab;
  }

  .delete-action {
    color: #ca3342;
    font-size: 1.2rem;
  }

  .step-index {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    border-radius: 999px;
    background: var(--bg-badge-muted);
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .step-copy {
    min-width: 0;
  }

  .step-heading,
  .step-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  code,
  .type-badge {
    color: var(--text-muted);
    font-size: 0.76rem;
  }

  .type-badge {
    border-radius: 999px;
    background: var(--bg-badge-muted);
    padding: 0.2rem 0.5rem;
  }

  p {
    margin-top: 0.45rem;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 0.82rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact-action {
    min-height: 34px;
    padding-inline: 0.7rem;
    font-size: 0.8rem;
  }

  .nested-groups {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.75rem;
    border-left: 2px solid var(--border-input);
    padding-left: 0.75rem;
  }

  .nested-group {
    display: grid;
    gap: 0.35rem;
  }

  .nested-group > span {
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .nested-step {
    display: flex;
    gap: 0.5rem;
    border-radius: 8px;
    background: var(--bg-page);
    padding: 0.45rem 0.6rem;
    font-size: 0.78rem;
  }

  @media (max-width: 720px) {
    .step-block {
      grid-template-columns: auto auto minmax(0, 1fr);
    }

    .step-actions {
      grid-column: 3;
    }
  }
</style>
