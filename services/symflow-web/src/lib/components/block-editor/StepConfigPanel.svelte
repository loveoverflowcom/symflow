<script lang="ts">
  import type { DslStep, TaskMeta } from '$lib/utils/dsl-tree';
  import { defaultTaskConfig } from '$lib/utils/dsl-tree';
  import AiAgentBlock from './blocks/AiAgentBlock.svelte';
  import FileReaderBlock from './blocks/FileReaderBlock.svelte';
  import ManualTriggerBlock from './blocks/ManualTriggerBlock.svelte';
  import WebScraperBlock from './blocks/WebScraperBlock.svelte';

  let { step, tasks, disabled = false, onChange, onClose } = $props<{
    step: DslStep;
    tasks: TaskMeta[];
    disabled?: boolean;
    onChange: (step: DslStep) => void;
    onClose: () => void;
  }>();

  let genericText = $state('');
  let genericError = $state('');

  $effect(() => {
    genericText = JSON.stringify(step.with ?? {}, null, 2);
    genericError = '';
  });

  function updateConfig(value: Record<string, unknown>) {
    onChange({ ...step, with: value });
  }

  function updateGenericConfig() {
    try {
      const parsed = JSON.parse(genericText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Configuration must be an object');
      }
      genericError = '';
      updateConfig(parsed);
    } catch (cause) {
      genericError = cause instanceof Error ? cause.message : 'Invalid JSON';
    }
  }
</script>

<aside class="config-panel stack">
  <div class="config-heading">
    <div>
      <h3>Configure step</h3>
      <p>{step.id}</p>
    </div>
    <button type="button" class="close-button" onclick={onClose} aria-label="Close">×</button>
  </div>

  <label class="stack-sm">
    <span>Step ID</span>
    <input
      value={step.id}
      {disabled}
      oninput={(event) => onChange({ ...step, id: event.currentTarget.value })}
    />
  </label>

  <label class="stack-sm">
    <span>Task type</span>
    <select
      value={step.type}
      {disabled}
      onchange={(event) => {
        const type = event.currentTarget.value;
        const task = tasks.find((candidate: TaskMeta) => candidate.name === type);
        onChange({
          ...step,
          type,
          with: task ? defaultTaskConfig(task) : step.with
        });
      }}
    >
      {#each tasks as task}
        <option value={task.name}>{task.label}</option>
      {/each}
    </select>
  </label>

  <label class="stack-sm">
    <span>Needs (comma separated)</span>
    <input
      value={(step.needs ?? []).join(', ')}
      {disabled}
      oninput={(event) =>
        onChange({
          ...step,
          needs: event.currentTarget.value
            .split(',')
            .map((dependency) => dependency.trim())
            .filter(Boolean)
        })}
    />
  </label>

  {#if step.type === 'manual_trigger'}
    <ManualTriggerBlock value={step.with ?? {}} {disabled} onChange={updateConfig} />
  {:else if step.type === 'web_scraper'}
    <WebScraperBlock value={step.with ?? {}} {disabled} onChange={updateConfig} />
  {:else if step.type === 'local_file_reader'}
    <FileReaderBlock value={step.with ?? {}} {disabled} onChange={updateConfig} />
  {:else if step.type === 'ai_agent'}
    <AiAgentBlock value={step.with ?? {}} {disabled} onChange={updateConfig} />
  {:else}
    <label class="stack-sm">
      <span>with (JSON object)</span>
      <textarea
        bind:value={genericText}
        class="block-json-editor"
        {disabled}
        onblur={updateGenericConfig}
      ></textarea>
    </label>
    {#if genericError}<p class="error-message block-error">{genericError}</p>{/if}
  {/if}
</aside>

<style>
  .config-panel {
    position: sticky;
    top: 1rem;
    min-width: 0;
    border: 1px solid var(--border-card);
    border-radius: 12px;
    background: var(--bg-card);
    padding: 1rem;
  }

  .config-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }

  .config-heading p {
    margin-top: 0.25rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.78rem;
  }

  .close-button {
    min-width: 34px;
    min-height: 34px;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    font-size: 1.25rem;
  }

  select {
    width: 100%;
    border: 1px solid var(--border-input);
    border-radius: 10px;
    background: var(--bg-input);
    color: var(--text-primary);
    padding: 0.75rem;
  }

  :global(.block-json-editor) {
    min-height: 180px;
    resize: vertical;
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }

  :global(.block-textarea) {
    min-height: 100px;
    resize: vertical;
  }

  :global(.block-error) {
    font-size: 0.8rem;
  }
</style>
