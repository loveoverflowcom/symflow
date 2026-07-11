<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { evaluateTypeScriptDefault, executeWorkflow, inferInputSchema } from '@symflow/runtime';
  import type { TaskMeta, WorkflowInputSchema } from '@symflow/runtime';
  import { ApiError, saveFlow, saveRun } from '$lib/api/client';
  import { initializeTaskRegistry, taskCatalog, taskDeclarations } from '$lib/runtime';
  import AppShell from '$lib/components/AppShell.svelte';
  import TaskCatalog from '$lib/components/TaskCatalog.svelte';
  import WorkflowEditor from '$lib/components/WorkflowEditor.svelte';
  import WorkflowInputForm from '$lib/components/WorkflowInputForm.svelte';
  import { language, t } from '$lib/i18n';
  import type { ExecutionLog, FlowDetail } from '$lib/types/symflow';
  import { slugFromName } from '$lib/utils/format';
  import { DEFAULT_RUN_INPUT_SOURCE, DEFAULT_WORKFLOW_SOURCE } from '$lib/utils/workflow';

  let { flow } = $props<{ flow?: FlowDetail }>();

  let initialized = $state(false);
  let flowId = $state('');
  let name = $state('');
  let source = $state(DEFAULT_WORKFLOW_SOURCE);
  let runInputSource = $state(DEFAULT_RUN_INPUT_SOURCE);
  let errorMessage = $state('');
  let isSaving = $state(false);
  let isRunning = $state(false);
  let declarations = $state('');
  let tasks = $state<TaskMeta[]>([]);
  let tasksLoading = $state(true);
  let activeTab = $state<'workflow' | 'tasks'>('workflow');
  let workflowErrorCount = $state(0);
  let inputErrorCount = $state(0);
  let inputSchema = $state<WorkflowInputSchema | null>(null);
  let inputSchemaSignature = $state('');
  let formInputValues = $state<Record<string, unknown>>({});
  let inputMode = $state<'form' | 'code'>('form');

  const pageTitle = $derived(flow ? t($language, 'editFlow') : t($language, 'newFlow'));
  const runDisabled = $derived(
    isRunning ||
      !name ||
      !source ||
      workflowErrorCount > 0 ||
      (inputMode === 'code' && inputErrorCount > 0)
  );

  $effect(() => {
    if (initialized) return;
    flowId = flow?.id ?? '';
    name = flow?.name ?? '';
    source = flow?.dsl_script ?? DEFAULT_WORKFLOW_SOURCE;
    initialized = true;
  });

  onMount(async () => {
    try {
      declarations = await taskDeclarations();
      tasks = await taskCatalog();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Không tải được type của task registry.';
    } finally {
      tasksLoading = false;
    }
  });

  $effect(() => {
    const schema = inferInputSchema(source);
    inputSchema = schema;
    if (!schema) {
      inputMode = 'code';
      inputSchemaSignature = '';
    } else {
      const signature = JSON.stringify(schema);
      inputMode = 'form';
      if (signature !== inputSchemaSignature) {
        inputSchemaSignature = signature;
        formInputValues = reconcileFormInputValues(schema, formInputValues);
      }
    }
  });

  $effect(() => {
    if (!inputSchema) return;
    runInputSource = formValuesToRunInputSource(inputSchema, formInputValues);
  });

  async function persistFlow(): Promise<FlowDetail> {
    const saved = await saveFlow({
      id: flowId || slugFromName(name) || undefined,
      name,
      dsl_script: source
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
      errorMessage = error instanceof ApiError ? error.message : t($language, 'failedSaveFlow');
    } finally {
      isSaving = false;
    }
  }

  async function handleRun() {
    errorMessage = '';
    isRunning = true;
    let inputs: unknown;
    let logs: ExecutionLog[] = [];

    try {
      inputs = inputMode === 'form' && inputSchema
        ? plainWorkflowInput(formInputValues)
        : await evaluateTypeScriptDefault(runInputSource);
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

  function formValuesToRunInputSource(
    schema: WorkflowInputSchema,
    values: Record<string, unknown>
  ): string {
    const entries = Object.entries(schema.properties)
      .map(([key, field]) => `  ${JSON.stringify(key)}: ${valueToTypeScript(values[key], field)}`)
      .join(',\n');

    return [
      "import type { main } from './workflow';",
      '',
      'type WorkflowInput = Parameters<typeof main>[0];',
      '',
      'const input: WorkflowInput = {',
      entries,
      '};',
      '',
      'export default input;',
      ''
    ].join('\n');
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
      } else {
        next[key] = '';
      }
    }
    return next;
  }

  function valueToTypeScript(value: unknown, field: WorkflowInputSchema['properties'][string]): string {
    if (field.format === 'binary') {
      return 'undefined as unknown as File';
    }

    if (field.type === 'array') {
      return JSON.stringify(Array.isArray(value) ? value : []);
    }

    if (field.type === 'number') {
      return typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : 'undefined as unknown as number';
    }

    if (field.type === 'boolean') {
      return value === true ? 'true' : 'false';
    }

    return JSON.stringify(typeof value === 'string' ? value : '');
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
        <button class="primary-button" type="button" onclick={handleSave} disabled={isSaving || isRunning || !name || !source}>
          {isSaving ? t($language, 'saving') : t($language, 'saveFlow')}
        </button>
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
          <h2>TypeScript workflow</h2>
          {#if initialized}
            <WorkflowEditor
              bind:value={source}
              {declarations}
              disabled={isSaving || isRunning}
              onErrorCountChange={(count) => (workflowErrorCount = count)}
            />
          {/if}
        </section>

        <section class="editor-run card stack">
          <div class="stack-sm">
            <h2>{t($language, 'runInputsSection')}</h2>
            <p class="muted">
              Kiểu dữ liệu được lấy trực tiếp từ <code>main(input)</code>. Run input được tạo từ form và cập nhật theo workflow hiện tại.
            </p>
          </div>

          {#if inputMode === 'form' && inputSchema}
            <WorkflowInputForm
              schema={inputSchema}
              bind:value={formInputValues}
              disabled={isSaving || isRunning}
            />
          {:else}
            <WorkflowEditor
              bind:value={runInputSource}
              modelUri="file:///run-input.ts"
              height={300}
              disabled
              onErrorCountChange={(count) => (inputErrorCount = count)}
            />
          {/if}

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
</style>
