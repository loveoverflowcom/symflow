<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type * as Monaco from 'monaco-editor';
  import { configureMonacoWorkers } from '$lib/monaco';

  let {
    value = $bindable(''),
    disabled = false,
    declarations = '',
    modelUri = 'file:///workflow.ts',
    height = 540,
    onErrorCountChange
  } = $props<{
    value?: string;
    disabled?: boolean;
    declarations?: string;
    modelUri?: string;
    height?: number;
    onErrorCountChange?: (count: number) => void;
  }>();

  let container: HTMLDivElement | undefined;
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  let subscription: Monaco.IDisposable | undefined;
  let typeLibrary: Monaco.IDisposable | undefined;
  let monacoApi = $state.raw<typeof Monaco | undefined>(undefined);
  let diagnostics = $state<Monaco.editor.IMarker[]>([]);
  let checking = $state(true);
  let checkingTimer: number | undefined;
  let validationVersion = 0;
  let projectListener: (() => void) | undefined;
  let destroyed = false;

  const errorCount = $derived(
    diagnostics.filter((marker) => marker.severity === monacoApi?.MarkerSeverity.Error).length
  );
  const warningCount = $derived(
    diagnostics.filter((marker) => marker.severity === monacoApi?.MarkerSeverity.Warning).length
  );

  async function validateTypeScript() {
    const model = editor?.getModel();
    if (!model || !monacoApi) return;
    const version = ++validationVersion;
    checking = true;

    try {
      const getWorker = await monacoApi.languages.typescript.getTypeScriptWorker();
      const worker = await getWorker(model.uri);
      const fileName = model.uri.toString();
      const [syntax, semantic] = await Promise.all([
        worker.getSyntacticDiagnostics(fileName),
        worker.getSemanticDiagnostics(fileName)
      ]);
      if (version !== validationVersion) return;

      const markers: Monaco.editor.IMarkerData[] = [...syntax, ...semantic].map((diagnostic) => {
        const start = diagnostic.start ?? 0;
        const end = start + (diagnostic.length ?? 1);
        const startPosition = model.getPositionAt(start);
        const endPosition = model.getPositionAt(end);
        return {
          severity: diagnosticSeverity(diagnostic.category),
          message: flattenDiagnosticMessage(diagnostic.messageText),
          code: String(diagnostic.code),
          source: 'TypeScript',
          startLineNumber: startPosition.lineNumber,
          startColumn: startPosition.column,
          endLineNumber: endPosition.lineNumber,
          endColumn: endPosition.column
        };
      });
      monacoApi.editor.setModelMarkers(model, 'symflow-typescript', markers);
      diagnostics = monacoApi.editor.getModelMarkers({
        owner: 'symflow-typescript',
        resource: model.uri
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      monacoApi.editor.setModelMarkers(model, 'symflow-typescript', [
        {
          severity: monacoApi.MarkerSeverity.Error,
          message: `TypeScript Language Service failed: ${message}`,
          source: 'SymFlow',
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 2
        }
      ]);
      diagnostics = monacoApi.editor.getModelMarkers({
        owner: 'symflow-typescript',
        resource: model.uri
      });
    } finally {
      if (version === validationVersion) checking = false;
    }
  }

  function diagnosticSeverity(category: number): Monaco.MarkerSeverity {
    if (!monacoApi) return 8;
    if (category === 1) return monacoApi.MarkerSeverity.Error;
    if (category === 0) return monacoApi.MarkerSeverity.Warning;
    if (category === 2) return monacoApi.MarkerSeverity.Hint;
    return monacoApi.MarkerSeverity.Info;
  }

  function flattenDiagnosticMessage(message: string | { messageText: string; next?: unknown[] }): string {
    if (typeof message === 'string') return message;
    const children = Array.isArray(message.next)
      ? message.next.map((child) =>
          flattenDiagnosticMessage(child as { messageText: string; next?: unknown[] })
        )
      : [];
    return [message.messageText, ...children].filter(Boolean).join('\n');
  }

  function revealDiagnostic(marker: Monaco.editor.IMarker) {
    editor?.setPosition({
      lineNumber: marker.startLineNumber,
      column: marker.startColumn
    });
    editor?.revealPositionInCenter({
      lineNumber: marker.startLineNumber,
      column: marker.startColumn
    });
    editor?.focus();
  }

  function severityLabel(severity: number): string {
    if (severity === monacoApi?.MarkerSeverity.Error) return 'Error';
    if (severity === monacoApi?.MarkerSeverity.Warning) return 'Warning';
    return 'Info';
  }

  function scheduleValidation(delay = 250) {
    checking = true;
    if (checkingTimer) window.clearTimeout(checkingTimer);
    checkingTimer = window.setTimeout(validateTypeScript, delay);
  }

  onMount(async () => {
    configureMonacoWorkers();
    const monaco = await import('monaco-editor');
    if (destroyed || !container?.isConnected) return;
    monacoApi = monaco;
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      strict: true,
      noEmit: true,
      allowNonTsExtensions: true
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    if (declarations) {
      typeLibrary = monaco.languages.typescript.typescriptDefaults.addExtraLib(
        declarations,
        'file:///symflow/generated-task-registry.d.ts'
      );
    }
    const uri = monaco.Uri.parse(modelUri);
    const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(value, 'typescript', uri);
    if (model.getValue() !== value) model.setValue(value);
    if (destroyed || !container?.isConnected) return;
    editor = monaco.editor.create(container, {
      model,
      theme: 'vs-dark',
      fontSize: 14,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      readOnly: disabled,
      tabSize: 2,
      renderValidationDecorations: 'on',
      quickSuggestions: true,
      suggestOnTriggerCharacters: true
    });
    subscription = editor.onDidChangeModelContent(() => {
      value = editor?.getValue() ?? '';
      scheduleValidation(350);
      window.dispatchEvent(new CustomEvent('symflow:typescript-project-change'));
    });
    projectListener = () => scheduleValidation(350);
    window.addEventListener('symflow:typescript-project-change', projectListener);
    checkingTimer = window.setTimeout(validateTypeScript, 100);
  });

  $effect(() => {
    if (!editor) return;
    editor.updateOptions({ readOnly: disabled });
    if (editor.getValue() !== value) editor.setValue(value);
  });

  $effect(() => {
    if (!monacoApi || !declarations) return;
    typeLibrary?.dispose();
    typeLibrary = monacoApi.languages.typescript.typescriptDefaults.addExtraLib(
      declarations,
      'file:///symflow/generated-task-registry.d.ts'
    );
    void validateTypeScript();
    window.dispatchEvent(new CustomEvent('symflow:typescript-project-change'));
  });

  $effect(() => {
    onErrorCountChange?.(errorCount);
  });

  onDestroy(() => {
    destroyed = true;
    subscription?.dispose();
    typeLibrary?.dispose();
    if (projectListener) {
      window.removeEventListener('symflow:typescript-project-change', projectListener);
    }
    if (checkingTimer) window.clearTimeout(checkingTimer);
    editor?.getModel()?.dispose();
    editor?.dispose();
  });
</script>

<div bind:this={container} class="workflow-editor" style:height={`${height}px`}></div>

<section class="problems-panel" aria-live="polite">
  <header>
    <div>
      <strong>Problems</strong>
      {#if errorCount > 0}<span class="count error-count">{errorCount} errors</span>{/if}
      {#if warningCount > 0}<span class="count warning-count">{warningCount} warnings</span>{/if}
    </div>
    {#if checking}
      <span class="checking">Checking TypeScript…</span>
    {:else if diagnostics.length === 0}
      <span class="valid">No TypeScript problems</span>
    {/if}
  </header>

  {#if diagnostics.length > 0}
    <div class="problem-list">
      {#each diagnostics as marker}
        <button
          type="button"
          class:error={marker.severity === monacoApi?.MarkerSeverity.Error}
          class:warning={marker.severity === monacoApi?.MarkerSeverity.Warning}
          onclick={() => revealDiagnostic(marker)}
        >
          <span class="problem-icon">
            {marker.severity === monacoApi?.MarkerSeverity.Error ? '×' : '!'}
          </span>
          <span class="problem-message">{marker.message}</span>
          <code>Ln {marker.startLineNumber}, Col {marker.startColumn}</code>
          <span class="sr-only">{severityLabel(marker.severity)}</span>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .workflow-editor {
    width: 100%;
    height: 540px;
    overflow: hidden;
    border: 1px solid var(--border-input);
    border-radius: 12px;
  }

  .problems-panel {
    overflow: hidden;
    border: 1px solid var(--border-input);
    border-radius: 10px;
    background: var(--bg-page);
  }

  .problems-panel header {
    display: flex;
    min-height: 42px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-badge-muted);
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .problems-panel header > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .count {
    border-radius: 99px;
    padding: 2px 7px;
    font-size: 0.68rem;
  }

  .error-count {
    background: rgba(202, 51, 66, 0.11);
    color: #b52d3c;
  }

  .warning-count {
    background: rgba(217, 146, 28, 0.12);
    color: #a96d0e;
  }

  .checking {
    color: var(--text-subtle);
  }

  .valid {
    color: #298357;
  }

  .problem-list {
    display: grid;
    max-height: 210px;
    overflow-y: auto;
  }

  .problem-list button {
    display: grid;
    width: 100%;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    align-items: start;
    gap: 8px;
    border-top: 1px solid var(--border-input);
    padding: 9px 12px;
    background: transparent;
    color: var(--text-muted);
    text-align: left;
  }

  .problem-list button:hover {
    background: var(--bg-badge-muted);
  }

  .problem-icon {
    display: grid;
    width: 17px;
    height: 17px;
    place-items: center;
    border-radius: 50%;
    color: white;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .problem-list button.error .problem-icon {
    background: #ca3342;
  }

  .problem-list button.warning .problem-icon {
    background: #d9921c;
  }

  .problem-message {
    line-height: 1.4;
  }

  .problem-list code {
    color: var(--text-subtle);
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
</style>
