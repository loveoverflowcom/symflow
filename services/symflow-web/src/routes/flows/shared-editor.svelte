<script lang="ts">
  import { goto } from '$app/navigation';
  import { ApiError, saveFlow, triggerRun } from '$lib/api/client';
  import AppShell from '$lib/components/AppShell.svelte';
  import DslEditor from '$lib/components/DslEditor.svelte';
  import type { FlowDetail } from '$lib/types/symflow';
  import { slugFromName } from '$lib/utils/format';

  let { flow } = $props<{ flow?: FlowDetail }>();

  let initialized = $state(false);
  let flowId = $state('');
  let name = $state('');
  let dslScript = $state('');
  let runInputsText = $state('{\n  "input": "example"\n}');
  let errorMessage = $state('');
  let isSaving = $state(false);
  let isRunning = $state(false);

  const pageTitle = $derived(flow ? 'Edit flow' : 'New flow');

  $effect(() => {
    if (initialized) return;

    flowId = flow?.id ?? '';
    name = flow?.name ?? '';
    dslScript = flow?.dsl_script ?? '';
    initialized = true;
  });

  async function handleSave() {
    errorMessage = '';
    isSaving = true;

    try {
      const saved = await saveFlow({
        id: flowId || slugFromName(name) || undefined,
        name,
        dsl_script: dslScript
      });

      flowId = saved.id;
      await goto(`/flows/${saved.id}`);
    } catch (error) {
      errorMessage = error instanceof ApiError ? error.message : 'Failed to save flow.';
    } finally {
      isSaving = false;
    }
  }

  async function handleRun() {
    if (!flowId) {
      errorMessage = 'Save the flow before running it.';
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
        errorMessage = 'Run inputs must be valid JSON.';
      } else {
        errorMessage = error instanceof ApiError ? error.message : 'Failed to start run.';
      }
    } finally {
      isRunning = false;
    }
  }
</script>

<svelte:head>
  <title>{pageTitle} | Symflow</title>
</svelte:head>

<AppShell
  title={pageTitle}
  subtitle="Author the YAML DSL, save it to the backend, and trigger a run when you are ready."
>
  {#snippet actions()}
    <a class="secondary-button" href="/flows">Back to flows</a>
  {/snippet}

  <section class="editor-layout">
    <article class="card stack">
      <label class="stack-sm">
        <span>Name</span>
        <input bind:value={name} placeholder="hello-world-flow" />
      </label>

      <DslEditor bind:value={dslScript} disabled={isSaving || isRunning} />

      {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
      {/if}

      <div class="button-row">
        <button class="primary-button" type="button" onclick={handleSave} disabled={isSaving || !name || !dslScript}>
          {isSaving ? 'Saving...' : 'Save flow'}
        </button>
      </div>
    </article>

    <aside class="card stack">
      <div class="stack-sm">
        <h2>Run flow</h2>
        <p class="muted">Trigger a run with ad hoc JSON inputs after the flow has been saved.</p>
      </div>

      <label class="stack-sm">
        <span>Inputs</span>
        <textarea bind:value={runInputsText} class="dsl-editor compact" spellcheck="false"></textarea>
      </label>

      <button class="primary-button" type="button" onclick={handleRun} disabled={isRunning || !flowId}>
        {isRunning ? 'Starting...' : 'Run flow'}
      </button>
    </aside>
  </section>
</AppShell>
