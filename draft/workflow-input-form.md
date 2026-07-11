# Feature: Auto-generate a Form UI from the Workflow's `main()` Input Type

> Scope: replace (or augment) the raw TypeScript "run-input.ts" editor pane  
> with a visual form that is derived automatically from the workflow's `main(input)` signature.

---

## 1. The Problem

Currently, when a user wants to run a workflow they must write TypeScript in a second editor:

```typescript
// run-input.ts (current approach)
import type { main } from './workflow';
type WorkflowInput = Parameters<typeof main>[0];
const input: WorkflowInput = { url: 'https://example.com' };
export default input;
```

This is powerful but unfriendly. If the workflow declares:

```typescript
export async function main(input: { url: string; name: string }) { ... }
```

…the user should see a simple form with two text fields, not a code editor.

Similarly, if a field is typed `File` or `Blob`, an `<input type="file">` should appear automatically.

---

## 2. How It Works — High Level

```
Workflow source (TS)
        │
        ▼
  Extract main() parameter type via TypeScript Compiler API (ts-morph / tsc)
        │
        ▼
  Convert to JSON Schema  ← new utility: inferInputSchema()
        │
        ▼
  Render <WorkflowInputForm> — one field per property
        │
        ▼
  Collect values as plain object
        │
        ▼
  Pass to executeWorkflow(source, inputs)   ← no changes here
```

The existing `executeWorkflow` call in `handleRun()` is unchanged — it still receives a plain `inputs` object. The only change is **how that object is built**.

---

## 3. Files to Touch

### 3.1 New utility — `inferInputSchema()`

**File to create:** `packages/symflow-runtime/src/input-schema.ts`

This function receives the workflow TypeScript source string and returns a JSON Schema describing the `main()` first parameter.

**Approach — static AST parsing with `ts-morph`:**

1. Install `ts-morph` (TypeScript compiler wrapper):
   ```
   npm install ts-morph --save-dev   # in packages/symflow-runtime
   ```
2. Create a `Project`, add the source as a virtual file.
3. Find the exported `main` function declaration.
4. Get the first parameter's type node.
5. Walk the type properties and build a JSON Schema object.

**Supported type mappings:**

| TypeScript type | JSON Schema type | Form field |
|---|---|---|
| `string` | `{ type: "string" }` | `<input type="text">` |
| `number` | `{ type: "number" }` | `<input type="number">` |
| `boolean` | `{ type: "boolean" }` | `<input type="checkbox">` |
| `string[]` | `{ type: "array", items: { type: "string" } }` | comma-separated text |
| `File` / `Blob` | `{ type: "string", format: "binary" }` | `<input type="file">` |
| Optional `url?` | mark property `required: false` | field is optional |
| `string` with name containing `url` | add `format: "uri"` hint | `<input type="url">` |

**Fallback:** if parsing fails or the type is too complex, fall back to the existing TypeScript editor.

**Rough function signature:**

```typescript
// packages/symflow-runtime/src/input-schema.ts

export interface WorkflowInputSchema {
  type: 'object';
  properties: Record<string, FieldSchema>;
  required: string[];
}

export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array';
  format?: 'uri' | 'binary' | 'date';  // hints for the form renderer
  description?: string;
  items?: FieldSchema;   // for array types
}

export function inferInputSchema(workflowSource: string): WorkflowInputSchema | null;
```

Export `inferInputSchema` from `packages/symflow-runtime/src/index.ts`.

---

### 3.2 New Svelte component — `WorkflowInputForm.svelte`

**File to create:** `services/symflow-web/src/lib/components/WorkflowInputForm.svelte`

Receives a `WorkflowInputSchema` and renders a form field per property.

**Props:**

```typescript
let {
  schema,       // WorkflowInputSchema
  value,        // Record<string, unknown>  — two-way bound
  disabled,
}: {
  schema: WorkflowInputSchema;
  value: Record<string, unknown>;
  disabled?: boolean;
}
```

**Field rendering rules (inside `{#each}` over `schema.properties`):**

| `format` / `type` | Rendered as |
|---|---|
| `format: "binary"` | `<input type="file">` — on change, put the `File` object in `value[key]` |
| `format: "uri"` | `<input type="url">` |
| `type: "number"` | `<input type="number">` |
| `type: "boolean"` | `<input type="checkbox">` |
| `type: "array"` | `<input type="text">` with placeholder "comma-separated" — split on submit |
| everything else | `<input type="text">` |

Always show the property key as a `<label>`. Mark optional fields with a "(optional)" hint.

**No external dependencies needed** — plain HTML form elements only.

---

### 3.3 Modify `shared-editor.svelte`

**File:** `services/symflow-web/src/routes/flows/shared-editor.svelte`

This is where the two approaches are wired together.

#### a) Import new utilities

```typescript
import { inferInputSchema } from '@symflow/runtime';
import type { WorkflowInputSchema } from '@symflow/runtime';
import WorkflowInputForm from '$lib/components/WorkflowInputForm.svelte';
```

#### b) Add new state variables

```typescript
let inputSchema = $state<WorkflowInputSchema | null>(null);
let formInputValues = $state<Record<string, unknown>>({});
let inputMode = $state<'form' | 'code'>('form');
```

#### c) Derive the schema whenever `source` changes

Use a `$effect` that calls `inferInputSchema(source)` and updates `inputSchema`.
If the result is `null` (complex type or parse failure), automatically set `inputMode = 'code'`.

```typescript
$effect(() => {
  const schema = inferInputSchema(source);
  inputSchema = schema;
  if (!schema) inputMode = 'code';
});
```

#### d) Replace the run-input section markup

Replace the current single `<WorkflowEditor bind:value={runInputSource} ...>` block for the run inputs section with a conditional:

```
{#if inputMode === 'form' && inputSchema}
  <WorkflowInputForm
    schema={inputSchema}
    bind:value={formInputValues}
    {disabled}
  />
  <!-- toggle to switch to code mode -->
  <button onclick={() => (inputMode = 'code')}>Edit as TypeScript</button>
{:else}
  <WorkflowEditor bind:value={runInputSource} ... />
  <!-- only show toggle back if a schema was successfully parsed -->
  {#if inputSchema}
    <button onclick={() => (inputMode = 'form')}>Switch to Form</button>
  {/if}
{/if}
```

#### e) Update `handleRun()` to use the right input source

In `handleRun()`, determine inputs based on the active mode:

```typescript
if (inputMode === 'form' && inputSchema) {
  inputs = formInputValues;   // already a plain object
} else {
  inputs = await evaluateTypeScriptDefault(runInputSource);
}
```

Everything downstream (`executeWorkflow`, `saveRun`) is unchanged.

---

### 3.4 Modify `packages/symflow-runtime/src/index.ts`

Add the new exports so the web app can import them:

```typescript
export { inferInputSchema } from './input-schema';
export type { WorkflowInputSchema, FieldSchema } from './input-schema';
```

---

## 4. Handling `File` Inputs

When the workflow's `main()` declares a `File` parameter (e.g., for the ID card OCR node):

```typescript
export async function main(input: { image: File; name: string }) { ... }
```

`inferInputSchema` maps `File` → `{ type: "string", format: "binary" }`.  
`WorkflowInputForm` renders `<input type="file">` and puts the raw `File` object into `formInputValues.image`.

The workflow receives a real `File` object — no serialization needed since execution happens in-browser.

**Note:** `saveRun` sends `initial_input` to the backend. `File` objects are not JSON-serializable. Before calling `saveRun`, strip or replace `File` values with metadata:

```typescript
function serializeInputForPersistence(inputs: Record<string, unknown>): unknown {
  return Object.fromEntries(
    Object.entries(inputs).map(([k, v]) =>
      v instanceof File
        ? [k, { __type: 'File', name: v.name, size: v.size, type: v.type }]
        : [k, v]
    )
  );
}
```

Call this in `handleRun()` when building the `saveRun` payload.

---

## 5. Implementation Checklist

- [ ] Install `ts-morph` in `packages/symflow-runtime`
- [ ] Create `packages/symflow-runtime/src/input-schema.ts` with `inferInputSchema()`
- [ ] Export `inferInputSchema`, `WorkflowInputSchema`, `FieldSchema` from `src/index.ts`
- [ ] Create `services/symflow-web/src/lib/components/WorkflowInputForm.svelte`
- [ ] Add `inputSchema`, `formInputValues`, `inputMode` state to `shared-editor.svelte`
- [ ] Add `$effect` to derive schema from `source` changes
- [ ] Replace the run-input editor section with the form/code toggle
- [ ] Update `handleRun()` to pick inputs from form or TS editor based on `inputMode`
- [ ] Add `serializeInputForPersistence()` before calling `saveRun`
- [ ] Test: workflow with `{ url: string; name: string }` → shows 2 text fields
- [ ] Test: workflow with `{ image: File }` → shows file picker
- [ ] Test: workflow with complex/union type → falls back to TS editor gracefully

---

## 6. What Does NOT Change

- `executeWorkflow(source, inputs)` in `executor.ts` — untouched
- `saveRun` API call and `SaveRunPayload` type — untouched (only the input value preparation changes)
- The TypeScript code editor path — still available as a fallback or via the toggle
- `workflow.worker.ts` — untouched
- Any backend Rust code — untouched
