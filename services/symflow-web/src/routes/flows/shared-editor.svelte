<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { compileWorkflowGraph, executeWorkflow } from '@symflow/runtime';
  import type { TaskMeta, WorkflowGraph, WorkflowInputSchema } from '@symflow/runtime';
  import { ApiError, saveFlow, saveRun } from '$lib/api/client';
  import { initializeTaskRegistry, taskCatalog } from '$lib/runtime';
  import AppShell from '$lib/components/AppShell.svelte';
  import TaskCatalog from '$lib/components/TaskCatalog.svelte';
  import WorkflowGraphEditor from '$lib/components/WorkflowGraphEditor.svelte';
  import { language, t } from '$lib/i18n';
  import type { ExecutionLog, FlowDetail } from '$lib/types/symflow';
  import { slugFromName } from '$lib/utils/format';
  import { DEFAULT_WORKFLOW_SOURCE } from '$lib/utils/workflow';

  let { flow } = $props<{ flow?: FlowDetail }>();

  let initialized = $state(false);
  let flowId = $state('');
  let name = $state('');
  let source = $state(DEFAULT_WORKFLOW_SOURCE);
  let errorMessage = $state('');
  let isSaving = $state(false);
  let isRunning = $state(false);
  let tasks = $state<TaskMeta[]>([]);
  let tasksLoading = $state(true);
  let activeTab = $state<'workflow' | 'tasks'>('workflow');
  let graph = $state<WorkflowGraph>({ nodes: [] });
  let graphInputSchemaSignature = $state('');
  let formInputValues = $state<Record<string, unknown>>({});

  const graphCompileResult = $derived(compileWorkflowGraph(graph, tasks));
  const graphErrorCount = $derived(graphCompileResult.errors.length);
  const graphInputSchema = $derived(schemaFromGraphInputs(graph));

  const pageTitle = $derived(flow ? t($language, 'editFlow') : t($language, 'newFlow'));
  // Run values are transient and must never be part of the save gate. A flow
  // can be saved before its required file/text inputs are supplied.
  const missingRunInputs = $derived(requiredInputValuesMissing(graph, formInputValues));
  const saveDisabled = $derived(isSaving || isRunning || tasksLoading || graphErrorCount > 0 || !graphCompileResult.source);
  const saveDisabledReason = $derived(
    tasksLoading ? 'Đang tải task registry…'
      : graphErrorCount > 0 ? (graphCompileResult.errors[0]?.message ?? 'Workflow graph chưa hợp lệ.')
      : !graphCompileResult.source ? 'Workflow graph chưa thể compile.'
      : ''
  );
  const runDisabledReason = $derived(
    tasksLoading ? 'Đang tải task registry…'
      : graphErrorCount > 0 ? (graphCompileResult.errors[0]?.message ?? 'Workflow graph chưa hợp lệ.')
      : !graphCompileResult.source ? 'Workflow graph chưa thể compile.'
      : missingRunInputs.length > 0 ? `Chưa nhập giá trị bắt buộc: ${missingRunInputs.join(', ')}.`
      : ''
  );
  const runDisabled = $derived(isRunning || isSaving || !!runDisabledReason);

  $effect(() => {
    if (initialized) return;
    flowId = flow?.id ?? '';
    name = flow?.name ?? '';
    source = flow?.dsl_script ?? DEFAULT_WORKFLOW_SOURCE;
    graph = flow?.graph ?? { nodes: [] };
    initialized = true;
  });

  $effect(() => {
    const signature = JSON.stringify(graphInputSchema);
    if (signature === graphInputSchemaSignature) return;
    graphInputSchemaSignature = signature;
    formInputValues = reconcileFormInputValues(graphInputSchema, formInputValues);
  });

  $effect(() => {
    if (!graphCompileResult.source) return;
    source = graphCompileResult.source;
  });

  onMount(async () => {
    try {
      tasks = await taskCatalog();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Không tải được type của task registry.';
    } finally {
      tasksLoading = false;
    }
  });

  async function persistFlow(): Promise<FlowDetail> {
    if (!graphCompileResult.source) {
      throw new Error(graphCompileResult.errors[0]?.message ?? 'Graph workflow is invalid.');
    }
    source = graphCompileResult.source;
    if (!name.trim()) name = defaultWorkflowName(graph);
    const saved = await saveFlow({
      id: flowId || slugFromName(name) || undefined,
      name,
      dsl_script: source,
      graph
    });
    flowId = saved.id;
    return saved;
  }

  async function handleSave() {
    errorMessage = '';
    isSaving = true;
    try {
      const saved = await persistFlow();
      await goto(`/flows/${saved.id}`);
    } catch (error) {
      errorMessage = error instanceof ApiError
        ? `Save failed (${error.status}): ${error.message}`
        : error instanceof Error
          ? error.message
          : t($language, 'failedSaveFlow');
    } finally {
      isSaving = false;
    }
  }

  async function handleRun() {
    errorMessage = '';

    // Keep runtime input validation exclusively in the Run flow. This guard
    // also protects callers that invoke handleRun without the disabled button.
    if (missingRunInputs.length > 0) {
      errorMessage = `Chưa nhập giá trị bắt buộc: ${missingRunInputs.join(', ')}.`;
      return;
    }

    isRunning = true;
    let inputs: unknown;
    let logs: ExecutionLog[] = [];

    try {
      inputs = plainWorkflowInput(formInputValues);
      await persistFlow();
      await initializeTaskRegistry();
      const result = await executeWorkflow(source, inputs);
      logs = result.logs;
      const run = await saveRun({
        flow_id: flowId,
        initial_input: serializeInputForPersistence(inputs),
        status: 'SUCCESS',
        output: result.output,
        logs
      });
      await goto(`/runs/${run.id}`);
    } catch (error) {
      const runtimeError = error as Error & { logs?: ExecutionLog[] };
      logs = runtimeError.logs ?? logs;
      errorMessage = runtimeError.message || t($language, 'failedStartRun');
      if (flowId && inputs !== undefined && logs.length > 0) {
        const run = await saveRun({
          flow_id: flowId,
          initial_input: serializeInputForPersistence(inputs),
          status: 'FAILED',
          logs,
          error: errorMessage
        }).catch(() => null);
        if (run) await goto(`/runs/${run.id}`);
      }
    } finally {
      isRunning = false;
    }
  }

  function serializeInputForPersistence(input: unknown): unknown {
    if (isFileLike(input)) {
      const isFile = typeof File !== 'undefined' && input instanceof File;
      return {
        __type: isFile ? 'File' : 'Blob',
        name: isFile ? input.name : undefined,
        size: input.size,
        type: input.type
      };
    }

    if (Array.isArray(input)) {
      return input.map(serializeInputForPersistence);
    }

    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).map(([key, value]) => [
          key,
          serializeInputForPersistence(value)
        ])
      );
    }

    return input;
  }

  function isFileLike(value: unknown): value is File | Blob {
    return typeof Blob !== 'undefined' && value instanceof Blob;
  }

  function plainWorkflowInput(input: unknown): unknown {
    if (isFileLike(input)) return input;

    if (Array.isArray(input)) {
      return input.map(plainWorkflowInput);
    }

    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, plainWorkflowInput(value)])
      );
    }

    return input;
  }

  function reconcileFormInputValues(
    schema: WorkflowInputSchema,
    values: Record<string, unknown>
  ): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(schema.properties)) {
      if (values[key] !== undefined) {
        next[key] = values[key];
      } else if (field.type === 'array') {
        next[key] = [];
      } else if (field.type === 'boolean') {
        next[key] = false;
      } else if (field.type === 'object') {
        next[key] = {};
      } else {
        next[key] = '';
      }
    }
    return next;
  }

  function schemaFromGraphInputs(workflowGraph: WorkflowGraph): WorkflowInputSchema {
    const properties: WorkflowInputSchema['properties'] = {};
    const required: string[] = [];
    for (const input of workflowGraph.inputs ?? []) {
      const type = input.schema.type;
      if (type !== 'string' && type !== 'number' && type !== 'boolean' && type !== 'object' && type !== 'array') continue;
      properties[input.name] = {
        type,
        ...(input.schema.format === 'binary' || input.schema.format === 'date' || input.schema.format === 'uri'
          ? { format: input.schema.format }
          : {})
      };
      if (input.required !== false) required.push(input.name);
    }
    return { type: 'object', properties, required };
  }

  function requiredInputValuesMissing(workflowGraph: WorkflowGraph, values: Record<string, unknown>): string[] {
    return (workflowGraph.inputs ?? [])
      .filter((input) => input.required !== false && !inputValueIsPresent(input.schema, values[input.name]))
      .map((input) => input.name);
  }

  function inputValueIsPresent(schema: Record<string, unknown>, value: unknown): boolean {
    if (schema.format === 'binary') return isFileLike(value);
    if (schema.type === 'string') return typeof value === 'string' && value.trim().length > 0;
    if (schema.type === 'number' || schema.type === 'integer') return typeof value === 'number' && Number.isFinite(value);
    if (schema.type === 'boolean') return typeof value === 'boolean';
    if (schema.type === 'array') return Array.isArray(value);
    if (schema.type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
    return value !== undefined && value !== null;
  }

  function defaultWorkflowName(workflowGraph: WorkflowGraph): string {
    const taskName = workflowGraph.nodes[0]?.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow';
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    return `${taskName}-${timestamp}`;
  }
</script>

<svelte:head>
  <title>{pageTitle} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  {#snippet actions()}
    <a class="secondary-button" href="/flows">{t($language, 'backToFlows')}</a>
  {/snippet}

  <div class="flow-editor-page">
    <div class="page-title-block">
      <h1>{pageTitle}</h1>
      <p class="subtitle">TypeScript chạy trong browser; backend chỉ cung cấp task và lưu kết quả.</p>
    </div>

    <section class="flow-editor-stack">
      <header class="editor-topbar card">
        <label class="flow-name-field stack-sm">
          <span>{t($language, 'name')}</span>
          <input bind:value={name} placeholder="article-summary" />
        </label>
        <button class="primary-button" type="button" onclick={handleSave} disabled={saveDisabled}>
          {isSaving ? t($language, 'saving') : t($language, 'saveFlow')}
        </button>
        {#if saveDisabledReason && !isSaving}
          <p class="save-disabled-reason" aria-live="polite">{saveDisabledReason}</p>
        {/if}
      </header>

      <div class="tabs editor-tabs" role="tablist" aria-label="Workflow sections">
        <button
          type="button"
          role="tab"
          class:active={activeTab === 'workflow'}
          aria-selected={activeTab === 'workflow'}
          onclick={() => (activeTab = 'workflow')}
        >
          Workflow
        </button>
        <button
          type="button"
          role="tab"
          class:active={activeTab === 'tasks'}
          aria-selected={activeTab === 'tasks'}
          onclick={() => (activeTab = 'tasks')}
        >
          Tasks <span class="tab-count">{tasks.length}</span>
        </button>
      </div>

      {#if activeTab === 'workflow'}
        <section class="card stack-sm">
          <div class="authoring-header">
            <div>
              <h2>Graph workflow</h2>
              <p class="muted">Bind each task input to a compatible field from the workflow input or an earlier task.</p>
            </div>
          </div>
          {#if initialized}
            <WorkflowGraphEditor
              bind:graph
              bind:inputValues={formInputValues}
              {tasks}
              errors={graphCompileResult.errors}
              disabled={isSaving || isRunning || tasksLoading}
            />
            {#if graphCompileResult.source}
              <details class="generated-source">
                <summary>Generated TypeScript preview</summary>
                <pre><code>{graphCompileResult.source}</code></pre>
              </details>
            {/if}
          {/if}
        </section>

        <section class="editor-run card stack">
          <div class="stack-sm">
            <h2>{t($language, 'runInputsSection')}</h2>
            <p class="muted">Values from the fixed Workflow input node are passed to main(input).</p>
          </div>

          <p class="muted">Input values are edited directly in the fixed Workflow input node above.</p>
          {#if runDisabledReason && !isRunning}<p class="run-disabled-reason" aria-live="polite">{runDisabledReason}</p>{/if}

          <button
            class="primary-button"
            type="button"
            onclick={handleRun}
            disabled={runDisabled}
          >
            {isRunning ? 'Đang chạy trong browser…' : t($language, 'runFlow')}
          </button>
        </section>
      {:else}
        <TaskCatalog {tasks} loading={tasksLoading} />
      {/if}

      {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
      {/if}
    </section>
  </div>
</AppShell>

<style>
  .editor-tabs {
    width: fit-content;
  }

  .tab-count {
    display: inline-grid;
    min-width: 20px;
    height: 20px;
    margin-left: 5px;
    place-items: center;
    border-radius: 99px;
    background: var(--bg-page);
    color: var(--text-subtle);
    font-size: 0.68rem;
  }

  .authoring-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }

  .authoring-header p { margin-top: .35rem; }

  .editor-topbar { position: relative; flex-wrap: wrap; }
  .save-disabled-reason { flex: 0 0 100%; margin: -.35rem 0 0; color: #b52d3c; font-size: .82rem; }
  .run-disabled-reason { margin: 0; color: #b52d3c; font-size: .82rem; }
  .generated-source { overflow: hidden; border: 1px solid var(--border-input); border-radius: 10px; }
  .generated-source summary { padding: .7rem .85rem; cursor: pointer; color: var(--text-muted); }
  .generated-source pre { overflow: auto; margin: 0; padding: 1rem; border-top: 1px solid var(--border-input); background: var(--bg-page); font-size: .78rem; }
</style>
