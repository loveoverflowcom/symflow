<script lang="ts">
  import { goto } from '$app/navigation';
  import { ApiError, saveFlow, triggerRun } from '$lib/api/client';
  import AppShell from '$lib/components/AppShell.svelte';
  import FlowCanvas from '$lib/components/flow-canvas/FlowCanvas.svelte';
  import DslEditor from '$lib/components/DslEditor.svelte';
  import { language, t } from '$lib/i18n';
  import type { FlowDetail } from '$lib/types/symflow';
  import { DEFAULT_FLOW_DSL, formatJsonDsl, formatJsonDslIfValid, parseJsonDsl } from '$lib/utils/dsl';
  import type { DslFlow } from '$lib/utils/flow-graph';
  import { slugFromName } from '$lib/utils/format';

  let { flow } = $props<{ flow?: FlowDetail }>();

  let initialized = $state(false);
  let flowId = $state('');
  let name = $state('');
  let dslScript = $state(DEFAULT_FLOW_DSL);
  let runInputsText = $state('{\n  "input": "example"\n}');
  let errorMessage = $state('');
  let isSaving = $state(false);
  let isRunning = $state(false);

  const pageTitle = $derived(flow ? t($language, 'editFlow') : t($language, 'newFlow'));
  const parsedDsl = $derived.by((): DslFlow | null => {
    try {
      const parsed = parseJsonDsl(dslScript);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray((parsed as { steps?: unknown }).steps)
      ) {
        return null;
      }
      return parsed as DslFlow;
    } catch {
      return null;
    }
  });

  $effect(() => {
    if (initialized) return;

    flowId = flow?.id ?? '';
    name = flow?.name ?? '';
    dslScript = flow ? formatJsonDslIfValid(flow.dsl_script) : DEFAULT_FLOW_DSL;
    initialized = true;
  });

  async function handleSave() {
    errorMessage = '';
    isSaving = true;

    try {
      dslScript = formatJsonDsl(dslScript);
      const saved = await saveFlow({
        id: flowId || slugFromName(name) || undefined,
        name,
        dsl_script: dslScript
      });

      flowId = saved.id;
      await goto(`/flows/${saved.id}`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        errorMessage = t($language, 'invalidJson');
      } else {
        errorMessage = error instanceof ApiError ? error.message : t($language, 'failedSaveFlow');
      }
    } finally {
      isSaving = false;
    }
  }

  async function handleRun() {
    if (!flowId) {
      errorMessage = t($language, 'saveBeforeRun');
      return;
    }

    errorMessage = '';
    isRunning = true;

    try {
      const inputs = runInputsText.trim() ? JSON.parse(runInputsText) : {};
      const run = await triggerRun(flowId, inputs);
      await goto(`/runs/${run.id}`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        errorMessage = t($language, 'runInputsInvalidJson');
      } else {
        errorMessage = error instanceof ApiError ? error.message : t($language, 'failedStartRun');
      }
    } finally {
      isRunning = false;
    }
  }
</script>

<svelte:head>
  <title>{pageTitle} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  {#snippet actions()}
    <a class="secondary-button" href="/flows">{t($language, 'backToFlows')}</a>
  {/snippet}

  <div class="page-title-block">
    <h1>{pageTitle}</h1>
    <p class="subtitle">{t($language, 'editorSubtitle')}</p>
  </div>

  <section class="editor-layout">
    <article class="card stack">
      <label class="stack-sm">
        <span>{t($language, 'name')}</span>
        <input bind:value={name} placeholder="hello-world-flow" />
      </label>

      {#if initialized && parsedDsl}
        <div class="canvas-container">
          <FlowCanvas
            dsl={parsedDsl}
            flowId={flowId || 'new-flow'}
            flowName={name || t($language, 'untitledFlow')}
            disabled={isSaving || isRunning}
            onDslChange={(newDsl) => {
              dslScript = JSON.stringify(newDsl, null, 2);
            }}
          />
        </div>
        <p class="canvas-hint">{t($language, 'canvasKeyboardHint')}</p>
      {:else if initialized}
        <div class="invalid-dsl-notice">
          <strong>{t($language, 'invalidDslForCanvas')}</strong>
          <span>{t($language, 'invalidDslForCanvasDescription')}</span>
        </div>
        <DslEditor bind:value={dslScript} disabled={isSaving || isRunning} />
      {/if}

      {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
      {/if}

      <div class="button-row">
        <button class="primary-button" type="button" onclick={handleSave} disabled={isSaving || !name || !dslScript}>
          {isSaving ? t($language, 'saving') : t($language, 'saveFlow')}
        </button>
      </div>
    </article>

    <aside class="card stack">
      <div class="stack-sm">
        <h2>{t($language, 'runFlow')}</h2>
        <p class="muted">{t($language, 'runFlowDescription')}</p>
      </div>

      <label class="stack-sm">
        <span>{t($language, 'inputs')}</span>
        <textarea bind:value={runInputsText} class="dsl-editor compact" spellcheck="false"></textarea>
      </label>

      <button class="primary-button" type="button" onclick={handleRun} disabled={isRunning || !flowId}>
        {isRunning ? t($language, 'starting') : t($language, 'runFlow')}
      </button>
    </aside>
  </section>
</AppShell>

<style>
  .canvas-container {
    height: 540px;
    overflow: hidden;
    border: 1px solid #d8dce1;
    border-radius: 12px;
    background: #f8f9fa;
  }

  .canvas-hint {
    color: #9298a1;
    font-size: 0.72rem;
  }

  .invalid-dsl-notice {
    display: grid;
    gap: 4px;
    border: 1px solid rgba(202, 51, 66, 0.18);
    border-radius: 10px;
    padding: 11px 13px;
    background: rgba(202, 51, 66, 0.05);
    color: #8d3942;
    font-size: 0.78rem;
  }

  .invalid-dsl-notice span {
    color: #9b6970;
  }
</style>
