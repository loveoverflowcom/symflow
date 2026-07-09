<script lang="ts">
  import { language, t } from '$lib/i18n';
  import { DEFAULT_FLOW_DSL, formatJsonDsl, parseJsonDsl } from '$lib/utils/dsl';

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
      parseJsonDsl(value || '');
      validationMessage = t($language, 'validJson');
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : '';
      validationMessage = `${t($language, 'invalidJson')}${detail}`;
    }
  }

  function formatDsl() {
    try {
      value = formatJsonDsl(value);
      validationMessage = t($language, 'validJson');
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : '';
      validationMessage = `${t($language, 'invalidJson')}${detail}`;
    }
  }
</script>

<div class="stack">
  <div class="editor-toolbar">
    <span class="muted">{t($language, 'jsonDsl')}</span>
    <div class="button-row">
      <button class="secondary-button" type="button" onclick={formatDsl} disabled={disabled}>
        {t($language, 'formatJson')}
      </button>
      <button class="secondary-button" type="button" onclick={validateDsl} disabled={disabled}>
        {t($language, 'validate')}
      </button>
    </div>
  </div>

  <textarea
    bind:value
    class="dsl-editor"
    disabled={disabled}
    placeholder={DEFAULT_FLOW_DSL}
    spellcheck="false"
  ></textarea>

  {#if validationMessage}
    <p class="muted">{validationMessage}</p>
  {/if}
</div>
