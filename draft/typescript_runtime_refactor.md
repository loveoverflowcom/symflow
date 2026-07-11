# SymFlow TypeScript Runtime: Browser-based Workflow Execution

## Tổng quan

Bỏ hoàn toàn `symflow-core` executor và JSON DSL format. Thay bằng kiến trúc mới:

- **Workflow = TypeScript source code** lưu trong DB
- **Execution = browser** — transpile TS → JS, chạy trong sandbox
- **Backend = task provider + storage** — không compile, không execute flow

```text
Browser
  ├─ TypeScript Editor (Monaco)
  ├─ esbuild-wasm (TS → JS transpile)
  ├─ Workflow Executor (Web Worker sandbox)
  └─ Task Registry
       ├─ Local Tasks  (JS functions, chạy trong browser)
       └─ Remote Tasks (gọi /api/tasks/* trên backend)

Backend (symflow-api)
  ├─ Task Endpoints  (/api/tasks/*)
  ├─ Flow Storage    (/api/flows)
  └─ Run Logs        (/api/runs)
```

---

## Workflow format mới

Workflows là TypeScript thuần. Không còn JSON DSL, không còn `steps[]`, không còn `needs`.

```typescript
import { task } from '@symflow/runtime';

export async function main(input: { url: string }) {
  const article = await task('web_scraper', { url: input.url });

  const summary = await task('ai_agent', {
    goal: 'Tóm tắt nội dung',
    context: article.html
  });

  return { summary };
}
```

Control flow là TypeScript native:

```typescript
import { task } from '@symflow/runtime';

export async function main(input: { urls: string[] }) {
  // Parallel
  const articles = await Promise.all(
    input.urls.map(url => task('web_scraper', { url }))
  );

  // Conditional
  const summaries = [];
  for (const article of articles) {
    if (article.html.length > 500) {
      const result = await task('ai_agent', {
        goal: 'Tóm tắt',
        context: article.html
      });
      summaries.push(result);
    }
  }

  return { summaries };
}
```

---

## Task interface

Mọi task đều có cùng interface, bất kể chạy ở đâu:

```typescript
// packages/symflow-runtime/src/types.ts

export type TaskFn<I = unknown, O = unknown> = (input: I) => Promise<O>;

export interface TaskMeta {
  name: string;           // "web_scraper"
  label: string;          // "Web Scraper"
  description: string;
  category: string;       // "data", "ai", "storage", "util"
  runtime: 'local' | 'remote';
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}
```

### Local task (browser)

```typescript
// packages/symflow-runtime/src/tasks/csv.ts
export const csvCreate: TaskFn<{ rows: Record<string, unknown>[] }, { csv: string }> =
  async ({ rows }) => {
    const header = Object.keys(rows[0]).join(',');
    const body = rows.map(row => Object.values(row).join(',')).join('\n');
    return { csv: `${header}\n${body}` };
  };
```

### Remote task (backend)

```typescript
// packages/symflow-runtime/src/tasks/remote.ts
export function remoteTask(name: string): TaskFn {
  return async (input) => {
    const res = await fetch(`/api/tasks/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error(`Task "${name}" failed: ${res.statusText}`);
    return res.json();
  };
}
```

---

## Task Registry

Singleton khởi tạo một lần khi app load:

```typescript
// packages/symflow-runtime/src/registry.ts
export class TaskRegistry {
  private map = new Map<string, { meta: TaskMeta; fn: TaskFn }>();

  register(meta: TaskMeta, fn: TaskFn) {
    this.map.set(meta.name, { meta, fn });
  }

  get(name: string): TaskFn {
    const entry = this.map.get(name);
    if (!entry) throw new Error(`Task not found: "${name}"`);
    return entry.fn;
  }

  list(): TaskMeta[] {
    return Array.from(this.map.values()).map(e => e.meta);
  }
}

export const registry = new TaskRegistry();

// Hàm duy nhất mà workflow code gọi
export async function task<I, O>(name: string, input: I): Promise<O> {
  return registry.get(name)(input) as Promise<O>;
}
```

Khởi động app trong `+layout.ts`:

```typescript
import { registry } from '@symflow/runtime';
import { csvCreate } from '@symflow/runtime/tasks/local';
import { remoteTask } from '@symflow/runtime/tasks/remote';

export async function load() {
  // 1. Đăng ký local tasks
  registry.register(
    { name: 'csv.create', label: 'Create CSV', runtime: 'local', ... },
    csvCreate
  );

  // 2. Load remote task metadata từ backend, auto-register
  const res = await fetch('/api/tasks');
  const remoteTasks: TaskMeta[] = await res.json();
  for (const meta of remoteTasks) {
    registry.register(meta, remoteTask(meta.name));
  }
}
```

---

## Browser Executor

Transpile và chạy workflow trong Web Worker để không block UI:

```typescript
// packages/symflow-runtime/src/executor.ts
import { initialize, transform } from 'esbuild-wasm';

let esbuildReady = false;

async function ensureEsbuild() {
  if (esbuildReady) return;
  await initialize({ wasmURL: '/esbuild.wasm' });
  esbuildReady = true;
}

export interface ExecutionLog {
  type: 'task_start' | 'task_done' | 'task_error' | 'success' | 'error';
  name?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  timestamp: number;
}

export async function executeWorkflow(
  source: string,
  initialInput: unknown = {}
): Promise<{ output: unknown; logs: ExecutionLog[] }> {
  await ensureEsbuild();

  // Transpile TypeScript → JavaScript
  const { code } = await transform(source, {
    loader: 'ts',
    target: 'es2020',
    format: 'esm'
  });

  const logs: ExecutionLog[] = [];

  // Inject task() function với logging
  const instrumentedTask = async (name: string, input: unknown) => {
    logs.push({ type: 'task_start', name, input, timestamp: Date.now() });
    try {
      const output = await registry.get(name)(input);
      logs.push({ type: 'task_done', name, output, timestamp: Date.now() });
      return output;
    } catch (err) {
      const error = String(err);
      logs.push({ type: 'task_error', name, error, timestamp: Date.now() });
      throw err;
    }
  };

  // Chạy trong isolated async scope
  const fn = new Function('task', 'input', `
    ${code}
    return main(input);
  `);

  try {
    const output = await fn(instrumentedTask, initialInput);
    logs.push({ type: 'success', output, timestamp: Date.now() });
    return { output, logs };
  } catch (err) {
    logs.push({ type: 'error', error: String(err), timestamp: Date.now() });
    throw err;
  }
}
```

---

## Editor UI

### Monaco TypeScript Editor

```svelte
<!-- services/symflow-web/src/lib/components/WorkflowEditor.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type * as Monaco from 'monaco-editor';

  let { value = '', onChange } = $props<{
    value: string;
    onChange: (v: string) => void;
  }>();

  let container: HTMLDivElement;
  let editor: Monaco.editor.IStandaloneCodeEditor;

  onMount(async () => {
    const monaco = await import('monaco-editor');

    // Type declarations cho @symflow/runtime
    monaco.languages.typescript.typescriptDefaults.addExtraLib(`
      declare module '@symflow/runtime' {
        export function task<I = unknown, O = unknown>(name: string, input: I): Promise<O>;
      }
    `);

    editor = monaco.editor.create(container, {
      value,
      language: 'typescript',
      theme: 'vs-dark',
      fontSize: 14,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false
    });

    editor.onDidChangeModelContent(() => onChange(editor.getValue()));
  });

  onDestroy(() => editor?.dispose());
</script>

<div bind:this={container} class="workflow-editor"></div>

<style>
  .workflow-editor {
    width: 100%;
    height: 520px;
    border: 1px solid var(--border-input);
    border-radius: 12px;
    overflow: hidden;
  }
</style>
```

### Block Editor → TypeScript (optional mode)

Block Editor vẫn tồn tại như helper cho người mới. Khi user chỉnh block, FE generate TypeScript tương ứng:

```typescript
// services/symflow-web/src/lib/utils/block-to-ts.ts
export function blocksToTypeScript(blocks: Block[]): string {
  const vars = blocks.map((b, i) => {
    const name = b.id ?? `step${i}`;
    const args = JSON.stringify(b.with ?? {}, null, 2)
      .split('\n').join('\n  ');
    return `  const ${name} = await task('${b.type}', ${args});`;
  });

  return [
    `import { task } from '@symflow/runtime';`,
    ``,
    `export async function main(input: unknown) {`,
    ...vars,
    `  return { ${blocks.map((b, i) => b.id ?? `step${i}`).join(', ')} };`,
    `}`
  ].join('\n');
}
```

User có thể switch sang TypeScript mode bất cứ lúc nào. Một chiều: Block → TS. Chiều ngược lại (TS → Block) không hỗ trợ vì TS có thể chứa logic tùy ý.

---

## Backend — Thay đổi

### Xóa hoàn toàn

- `symflow-core`: `compiler.rs`, `executor.rs`, `dsl.rs`, `resolver.rs`, `state.rs` — không dùng nữa
- `symflow-core`: `agent/` module — move thành một remote task endpoint
- `symflow-api`: `POST /api/flows/:id/run` endpoint — không còn trigger Rust executor

### Giữ lại

- `symflow-store`: schema `flows`, `flow_runs` — giữ nguyên, chỉ đổi semantic của `dsl_script`
- `symflow-api`: CRUD flows, CRUD runs, WebSocket `/api/runs/:id/logs` — giữ nguyên interface

### Thêm mới

**`GET /api/tasks`** — danh sách remote tasks:

```rust
// services/symflow-api/src/routes/tasks.rs
pub async fn list_tasks() -> Json<Vec<TaskMeta>> {
    Json(TASK_REGISTRY.list())
}
```

**`POST /api/tasks/:name`** — execute một remote task:

```rust
pub async fn run_task(
    Path(name): Path<String>,
    State(state): State<AppState>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let output = TASK_REGISTRY.execute(&name, input, &state).await?;
    Ok(Json(output))
}
```

Backend Task Registry (Rust):

```rust
// services/symflow-api/src/task_registry.rs
pub struct BackendTaskRegistry {
    tasks: HashMap<String, Box<dyn BackendTask>>
}

#[async_trait]
pub trait BackendTask: Send + Sync {
    fn meta(&self) -> TaskMeta;
    async fn execute(&self, input: Value, state: &AppState) -> Result<Value, ApiError>;
}
```

System tasks đăng ký khi khởi động:

```rust
// services/symflow-api/src/main.rs
let mut task_registry = BackendTaskRegistry::new();
task_registry.register(WebScraperTask);
task_registry.register(AiAgentTask);    // wraps symflow-core::agent
task_registry.register(FileReaderTask);
```

**`POST /api/runs`** — FE gửi log sau khi execution xong:

```rust
// FE đã chạy xong trong browser, chỉ cần persist log
pub async fn save_run(
    State(state): State<AppState>,
    Json(payload): Json<SaveRunPayload>,
) -> Result<Json<RunRecord>, ApiError> {
    let run_id = state.store.create_run(&payload.flow_id, payload.initial_input).await?;
    state.store.set_run_status(run_id, payload.status).await?;
    state.store.save_execution_logs(run_id, &payload.logs).await?;
    Ok(Json(state.store.get_run(run_id).await?))
}

#[derive(Deserialize)]
pub struct SaveRunPayload {
    pub flow_id: String,
    pub initial_input: Value,
    pub status: RunStatus,   // "SUCCESS" | "FAILED"
    pub output: Option<Value>,
    pub logs: Vec<ExecutionLog>,
}
```

---

## Database — Thay đổi

```sql
-- migration 0005: clean slate cho TypeScript runtime
-- Xóa step_executions (không còn step-level tracking ở DB)
DROP TABLE step_executions;

-- flows.dsl_script giờ chứa TypeScript source
-- Không cần thêm column, chỉ đổi convention
-- flows.dsl_script → TypeScript code (string)
COMMENT ON COLUMN flows.dsl_script IS 'TypeScript workflow source code';

-- flow_runs.agent_logs → execution logs từ browser
COMMENT ON COLUMN flow_runs.agent_logs IS 'JSON array of ExecutionLog from browser runtime';
```

---

## Execution flow end-to-end

```text
1. User mở /flows/:id
   └─ Load TypeScript source từ flows.dsl_script

2. User click "Run"
   ├─ transpileTypeScript(source)  → esbuild-wasm → JS
   ├─ executeWorkflow(js, input)
   │    ├─ task('web_scraper', {...})  → POST /api/tasks/web_scraper → Rust handler
   │    ├─ task('ai_agent', {...})     → POST /api/tasks/ai_agent    → Rust handler
   │    └─ return { result }
   └─ POST /api/runs  { flow_id, status, output, logs }
      └─ Redirect → /runs/:id

3. /runs/:id
   └─ Hiển thị logs từ flow_runs.agent_logs (đã lưu ở bước 2)
      Không cần WebSocket vì execution đã xong trước khi navigate
```

---

## Kế hoạch triển khai

### Phase 1 — symflow-runtime package

- Tạo `packages/symflow-runtime/` (TypeScript package, published vào workspace)
- Implement: `TaskRegistry`, `task()`, `transpileTypeScript()`, `executeWorkflow()`
- Viết unit tests cho executor với mock tasks

### Phase 2 — Backend task endpoints

- Thêm `GET /api/tasks` + `POST /api/tasks/:name` vào `symflow-api`
- Implement `BackendTaskRegistry` + `BackendTask` trait
- Migrate `web_scraper`, `ai_agent`, `local_file_reader` thành backend tasks
- Xóa `POST /api/flows/:id/run` endpoint

### Phase 3 — Frontend editor

- Thêm Monaco editor vào `symflow-web` (lazy import)
- Thay `shared-editor.svelte`: DslEditor → WorkflowEditor (TypeScript)
- Implement `blocksToTypeScript()` cho Block mode
- Cập nhật `POST /api/runs` payload từ FE

### Phase 4 — Xóa code cũ

- Xóa `symflow-core`: `compiler.rs`, `executor.rs`, `dsl.rs`, `resolver.rs`, `nodes/`, `sandbox.rs`
- Xóa `symflow-api`: flow execution logic, WebSocket run streaming
- Xóa `step_executions` table migration
- Xóa `@xyflow/svelte` + flow-canvas components khỏi `symflow-web`

---

## Rủi ro

| Rủi ro | Biện pháp |
|---|---|
| `new Function()` bị chặn bởi CSP | Dùng Web Worker thay vì `new Function`. Worker không bị hạn chế bởi `script-src` CSP |
| Long-running remote tasks timeout | Remote tasks (AI) có thể mất 30-60s. Browser fetch timeout mặc định không đủ — set `signal: AbortSignal.timeout(120_000)` |
| esbuild-wasm ~2MB WASM load time | Lazy load, chỉ initialize khi user mở editor lần đầu. Cache WASM binary trong browser |
| Monaco bundle size ~5MB | Dynamic import: `const monaco = await import('monaco-editor')`. Chunk splitting trong vite config |
| TypeScript syntax error làm crash | Wrap `transpileTypeScript()` + `executeWorkflow()` trong try/catch, hiển thị lỗi inline trong editor |
