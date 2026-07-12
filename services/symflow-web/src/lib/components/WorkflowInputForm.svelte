<script lang="ts">
  import type { FieldSchema, WorkflowInputSchema } from '@symflow/runtime';

  let {
    schema,
    value = $bindable({}),
    disabled = false
  } = $props<{
    schema: WorkflowInputSchema;
    value: Record<string, unknown>;
    disabled?: boolean;
  }>();
  let objectErrors = $state<Record<string, string>>({});

  const fields = $derived(schemaFields(schema));

  function setField(key: string, nextValue: unknown) {
    value = { ...value, [key]: nextValue };
  }

  function schemaFields(nextSchema: WorkflowInputSchema): Array<[string, FieldSchema]> {
    return Object.entries(nextSchema.properties);
  }

  function stringValue(key: string): string {
    const current = value[key];
    if (Array.isArray(current)) return current.join(', ');
    return typeof current === 'string' || typeof current === 'number' ? String(current) : '';
  }

  function numberValue(key: string): number | undefined {
    const current = value[key];
    return typeof current === 'number' ? current : undefined;
  }

  function booleanValue(key: string): boolean {
    return value[key] === true;
  }

  function selectedFileLabel(key: string): string | null {
    const current = value[key];
    if (typeof File === 'undefined' || !(current instanceof File)) return null;
    return `${current.name} (${(current.size / 1024).toFixed(1)} KB)`;
  }

  function updateArray(key: string, rawValue: string, field: FieldSchema) {
    const values = rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (field.items?.type === 'number') {
      setField(
        key,
        values
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item))
      );
      return;
    }

    setField(key, values);
  }

  function objectValue(key: string): string {
    const current = value[key];
    return JSON.stringify(current && typeof current === 'object' && !Array.isArray(current) ? current : {}, null, 2);
  }

  function updateObject(key: string, rawValue: string) {
    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Enter a JSON object.');
      setField(key, parsed);
      const { [key]: _ignored, ...remaining } = objectErrors;
      objectErrors = remaining;
    } catch (error) {
      objectErrors = { ...objectErrors, [key]: error instanceof Error ? error.message : 'Invalid JSON object.' };
    }
  }
</script>

<div class="workflow-input-form">
  {#each fields as [key, field]}
    <label class="workflow-field" class:checkbox-field={field.type === 'boolean'}>
      <span>
        {key}
        {#if !schema.required.includes(key)}
          <em>(optional)</em>
        {/if}
      </span>

      {#if field.format === 'binary'}
        {@const fileLabel = selectedFileLabel(key)}
        <input
          type="file"
          {disabled}
          onchange={(event) => setField(key, event.currentTarget.files?.[0])}
        />
        {#if fileLabel}
          <small class="file-hint">{fileLabel}</small>
        {/if}
      {:else if field.type === 'boolean'}
        <input
          type="checkbox"
          checked={booleanValue(key)}
          {disabled}
          onchange={(event) => setField(key, event.currentTarget.checked)}
        />
      {:else if field.type === 'number'}
        <input
          type="number"
          value={numberValue(key) ?? ''}
          {disabled}
          oninput={(event) => {
            const nextValue = event.currentTarget.value;
            setField(key, nextValue === '' ? undefined : Number(nextValue));
          }}
        />
      {:else if field.type === 'array'}
        <input
          type="text"
          value={stringValue(key)}
          placeholder="comma-separated"
          {disabled}
          oninput={(event) => updateArray(key, event.currentTarget.value, field)}
        />
      {:else if field.type === 'object'}
        <textarea
          rows="4"
          value={objectValue(key)}
          {disabled}
          oninput={(event) => updateObject(key, event.currentTarget.value)}
        ></textarea>
        {#if objectErrors[key]}<small class="field-error">{objectErrors[key]}</small>{/if}
      {:else}
        <input
          type={field.format === 'uri' ? 'url' : field.format === 'date' ? 'date' : 'text'}
          value={stringValue(key)}
          {disabled}
          oninput={(event) => setField(key, event.currentTarget.value)}
        />
      {/if}
    </label>
  {/each}
</div>

<style>
  .workflow-input-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.9rem;
  }

  .workflow-field {
    display: grid;
    min-width: 0;
    gap: 0.45rem;
  }

  .workflow-field span {
    color: var(--text-secondary);
    font-weight: 650;
  }

  .workflow-field em {
    color: var(--text-muted);
    font-size: 0.82rem;
    font-style: normal;
    font-weight: 500;
  }

  .file-hint {
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  .field-error { color: #b52d3c; }
  .workflow-field textarea { resize: vertical; font-family: monospace; font-size: .8rem; }

  .checkbox-field {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    min-height: 76px;
    border: 1px solid var(--border-input);
    border-radius: 12px;
    background: var(--bg-input);
    padding: 0.9rem 1rem;
  }

  .checkbox-field input {
    width: 20px;
    height: 20px;
    padding: 0;
  }
</style>
