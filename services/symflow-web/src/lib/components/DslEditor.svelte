<script lang="ts">
  import YAML from 'yaml';

  let {
    value = $bindable(''),
    disabled = false
  } = $props<{
    value?: string;
    disabled?: boolean;
  }>();

  let validationMessage = $state('');

  function validateDsl() {
    try {
      YAML.parse(value || '');
      validationMessage = 'DSL is valid YAML.';
    } catch (error) {
      validationMessage = error instanceof Error ? error.message : 'Invalid YAML';
    }
  }
</script>

<div class="stack">
  <div class="editor-toolbar">
    <span class="muted">YAML DSL</span>
    <button class="secondary-button" type="button" onclick={validateDsl} disabled={disabled}>
      Validate
    </button>
  </div>

  <textarea
    bind:value
    class="dsl-editor"
    disabled={disabled}
    placeholder="name: demo-flow&#10;steps:&#10;  - id: read_file&#10;    kind: local_file_reader"
    spellcheck="false"
  ></textarea>

  {#if validationMessage}
    <p class="muted">{validationMessage}</p>
  {/if}
</div>
