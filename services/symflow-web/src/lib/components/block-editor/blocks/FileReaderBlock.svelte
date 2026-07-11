<script lang="ts">
  let { value, disabled = false, onChange } = $props<{
    value: Record<string, unknown>;
    disabled?: boolean;
    onChange: (value: Record<string, unknown>) => void;
  }>();
</script>

<label class="stack-sm">
  <span>Path</span>
  <input
    value={String(value.path ?? value.filename ?? '')}
    {disabled}
    placeholder="sample.txt"
    oninput={(event) => {
      const { filename: _filename, ...rest } = value;
      onChange({ ...rest, path: event.currentTarget.value });
    }}
  />
</label>
