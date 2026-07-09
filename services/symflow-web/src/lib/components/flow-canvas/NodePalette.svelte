<script lang="ts">
  import { language, t } from '$lib/i18n';

  let {
    disabled = false,
    onAdd
  } = $props<{
    disabled?: boolean;
    onAdd: (stepType: string) => void;
  }>();

  const nodeTypes = [
    { type: 'manual_trigger', labelKey: 'manualTriggerNode', icon: '▶', color: '#14a76c' },
    { type: 'web_scraper', labelKey: 'webScraperNode', icon: '◎', color: '#168eea' },
    { type: 'local_file_reader', labelKey: 'fileReaderNode', icon: '▱', color: '#e49a19' },
    { type: 'agent', labelKey: 'agentNode', icon: '✦', color: '#8755db' }
  ] as const;

  function handleDragStart(event: DragEvent, nodeType: string) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData('application/symflow-node-type', nodeType);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
</script>

<nav class="node-palette" aria-label={t($language, 'availableNodes')}>
  <div class="palette-heading">
    <span>{t($language, 'nodes')}</span>
    <small>{t($language, 'dragToCanvas')}</small>
  </div>

  {#each nodeTypes as nodeType}
    <button
      class="palette-item"
      type="button"
      disabled={disabled}
      draggable={!disabled}
      ondragstart={(event) => handleDragStart(event, nodeType.type)}
      onclick={() => onAdd(nodeType.type)}
      style={`--palette-accent: ${nodeType.color}`}
    >
      <span class="palette-icon" aria-hidden="true">{nodeType.icon}</span>
      <span>{t($language, nodeType.labelKey)}</span>
      <span class="drag-dots" aria-hidden="true">⠿</span>
    </button>
  {/each}
</nav>

<style>
  .node-palette {
    display: flex;
    width: 176px;
    flex: 0 0 176px;
    flex-direction: column;
    gap: 7px;
    padding: 14px 10px;
    border-right: 1px solid #e0e3e7;
    background: rgba(249, 250, 251, 0.95);
  }

  .palette-heading {
    display: grid;
    gap: 2px;
    padding: 1px 5px 9px;
  }

  .palette-heading > span {
    color: #4e555e;
    font-size: 0.7rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .palette-heading small {
    color: #9aa0a8;
    font-size: 0.65rem;
  }

  .palette-item {
    display: flex;
    min-height: 42px;
    align-items: center;
    gap: 8px;
    border: 1px solid color-mix(in srgb, var(--palette-accent) 28%, #dfe2e6);
    border-radius: 9px;
    padding: 0 9px;
    background: white;
    color: #444a52;
    cursor: grab;
    font-size: 0.74rem;
    font-weight: 620;
    text-align: left;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      transform 0.15s ease;
  }

  .palette-item:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--palette-accent);
    background: color-mix(in srgb, var(--palette-accent) 5%, white);
  }

  .palette-item:active:not(:disabled) {
    cursor: grabbing;
  }

  .palette-item:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .palette-icon {
    display: inline-grid;
    width: 24px;
    height: 24px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 7px;
    background: color-mix(in srgb, var(--palette-accent) 12%, white);
    color: var(--palette-accent);
    font-size: 0.8rem;
  }

  .drag-dots {
    margin-left: auto;
    color: #b2b7bd;
    font-size: 0.9rem;
  }

  @media (max-width: 760px) {
    .node-palette {
      width: 132px;
      flex-basis: 132px;
    }

    .drag-dots {
      display: none;
    }
  }
</style>
