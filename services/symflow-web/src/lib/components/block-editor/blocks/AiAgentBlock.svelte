<script lang="ts">
  let { value, disabled = false, onChange } = $props<{
    value: Record<string, unknown>;
    disabled?: boolean;
    onChange: (value: Record<string, unknown>) => void;
  }>();

  function toolsText(): string {
    return Array.isArray(value.allowed_tools) ? value.allowed_tools.join(', ') : '';
  }
</script>

<label class="stack-sm">
  <span>Model</span>
  <input
    value={String(value.model ?? '')}
    {disabled}
    placeholder="gpt-4o-mini"
    oninput={(event) => onChange({ ...value, model: event.currentTarget.value })}
  />
</label>
<label class="stack-sm">
  <span>Goal</span>
  <textarea
    value={String(value.goal ?? '')}
    {disabled}
    class="block-textarea"
    oninput={(event) => onChange({ ...value, goal: event.currentTarget.value })}
  ></textarea>
</label>
<label class="stack-sm">
  <span>Context</span>
  <textarea
    value={String(value.context ?? '')}
    {disabled}
    class="block-textarea"
    oninput={(event) => onChange({ ...value, context: event.currentTarget.value })}
  ></textarea>
</label>
<label class="stack-sm">
  <span>Max iterations</span>
  <input
    type="number"
    min="1"
    value={Number(value.max_iterations ?? 10)}
    {disabled}
    oninput={(event) =>
      onChange({ ...value, max_iterations: Number(event.currentTarget.value) || 1 })}
  />
</label>
<label class="stack-sm">
  <span>Allowed tools</span>
  <input
    value={toolsText()}
    {disabled}
    placeholder="string_analyzer, local_file_writer"
    oninput={(event) =>
      onChange({
        ...value,
        allowed_tools: event.currentTarget.value
          .split(',')
          .map((tool) => tool.trim())
          .filter(Boolean)
      })}
  />
</label>
