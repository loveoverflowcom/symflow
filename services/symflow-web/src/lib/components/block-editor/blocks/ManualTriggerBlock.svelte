<script lang="ts">
  let { value, disabled = false, onChange } = $props<{
    value: Record<string, unknown>;
    disabled?: boolean;
    onChange: (value: Record<string, unknown>) => void;
  }>();

  let text = $state('');
  let error = $state('');

  $effect(() => {
    text = JSON.stringify(value ?? {}, null, 2);
  });

  function update() {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Configuration must be an object');
      }
      error = '';
      onChange(parsed);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Invalid JSON';
    }
  }
</script>

<label class="stack-sm">
  <span>with (JSON object)</span>
  <textarea bind:value={text} class="block-json-editor" {disabled} onblur={update}></textarea>
</label>
{#if error}<p class="error-message block-error">{error}</p>{/if}
