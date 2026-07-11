<script lang="ts">
  let { value, disabled = false, onChange } = $props<{
    value: Record<string, unknown>;
    disabled?: boolean;
    onChange: (value: Record<string, unknown>) => void;
  }>();
</script>

<label class="stack-sm">
  <span>URL</span>
  <input
    value={String(value.url ?? '')}
    {disabled}
    placeholder="https://example.com"
    oninput={(event) => onChange({ ...value, url: event.currentTarget.value })}
  />
</label>
