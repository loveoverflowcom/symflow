<script lang="ts">
  import { language, t } from '$lib/i18n';
  import type { FlowNode } from '$lib/utils/flow-graph';

  let {
    node,
    disabled = false,
    onUpdate,
    onClose
  } = $props<{
    node: FlowNode | null;
    disabled?: boolean;
    onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
    onClose: () => void;
  }>();

  let configText = $state('');
  let validationError = $state('');

  $effect(() => {
    if (node) {
      configText = JSON.stringify(node.data.config ?? {}, null, 2);
      validationError = '';
    }
  });

  function applyConfig() {
    if (!node) return;

    try {
      const parsed: unknown = JSON.parse(configText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        validationError = t($language, 'configMustBeObject');
        return;
      }
      onUpdate(node.id, parsed as Record<string, unknown>);
      validationError = '';
    } catch {
      validationError = t($language, 'invalidJson');
    }
  }
</script>

{#if node}
  <aside class="config-panel" aria-label={t($language, 'nodeConfiguration')}>
    <div class="config-header">
      <div>
        <span>{t($language, 'configureNode')}</span>
        <h3>{node.data.label}</h3>
      </div>
      <button type="button" onclick={onClose} aria-label={t($language, 'close')}>×</button>
    </div>

    <div class="config-body">
      <label>
        <span>{t($language, 'stepId')}</span>
        <input value={node.id} disabled />
      </label>
      <label>
        <span>{t($language, 'type')}</span>
        <input value={node.data.stepType} disabled />
      </label>
      <label>
        <span>{t($language, 'configJson')}</span>
        <textarea bind:value={configText} rows="10" spellcheck="false" disabled={disabled}></textarea>
      </label>

      {#if validationError}
        <p class="config-error" role="alert">{validationError}</p>
      {/if}

      <button class="primary-button apply-button" type="button" onclick={applyConfig} disabled={disabled}>
        {t($language, 'apply')}
      </button>
    </div>
  </aside>
{/if}

<style>
  .config-panel {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    display: flex;
    width: 290px;
    height: 100%;
    flex-direction: column;
    border-left: 1px solid #dfe2e6;
    background: rgba(255, 255, 255, 0.97);
    box-shadow: -14px 0 34px rgba(31, 36, 43, 0.08);
    backdrop-filter: blur(18px);
  }

  .config-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 15px 17px;
    border-bottom: 1px solid #e4e6e9;
  }

  .config-header div {
    min-width: 0;
  }

  .config-header span {
    color: #9298a0;
    font-size: 0.62rem;
    font-weight: 720;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .config-header h3 {
    overflow: hidden;
    margin-top: 3px;
    color: #282c31;
    font-size: 0.9rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .config-header button {
    display: grid;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 7px;
    background: #f1f3f5;
    color: #686e76;
    font-size: 1.1rem;
  }

  .config-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
    padding: 17px;
  }

  label {
    display: grid;
    gap: 5px;
    color: #555c65;
    font-size: 0.72rem;
    font-weight: 620;
  }

  input,
  textarea {
    border-radius: 8px;
    padding: 9px 10px;
    font-size: 0.74rem;
  }

  input:disabled {
    color: #777e87;
    background: #f5f6f7;
  }

  textarea {
    min-height: 190px;
    font-family:
      "JetBrains Mono",
      ui-monospace,
      monospace;
    line-height: 1.5;
    resize: vertical;
  }

  .config-error {
    color: #c83e4d;
    font-size: 0.72rem;
  }

  .apply-button {
    width: 100%;
    min-height: 38px;
  }

  @media (max-width: 680px) {
    .config-panel {
      width: min(290px, calc(100% - 132px));
    }
  }
</style>
