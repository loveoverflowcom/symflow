# Symflow — TODO Roadmap

> Cập nhật sau lần review thứ hai. Đối chiếu `draft/flowagent_docs/` với code hiện tại trong
> `services/symflow-api`, `services/symflow-web`, `services/symflow-cli`, `packages/symflow-store`.

---

## Trạng thái hiện tại

| Thành phần | Trạng thái |
|---|---|
| `symflow-core` — DSL, DAG, Executor, Agent ReAct, Tool Registry | ✅ Done |
| `symflow-core` — MemoryStore | ✅ Done |
| `symflow-store` — repositories (flows, flow_runs, step_executions) | ✅ Done |
| `symflow-store` — models (sqlx row types + `into_record`) | ✅ Done |
| `symflow-store` — `PgStore` struct bọc repositories | ✅ Done |
| `symflow-store` — SQL migrations | ✅ Done |
| `symflow-api` — REST endpoints đầy đủ | ✅ Done |
| `symflow-api` — WebSocket `/api/runs/:id/logs` | ✅ Done |
| `symflow-api` — `AppState.store` dùng `Arc<dyn Store>` (trait object) | ✅ Done |
| `symflow-api` — Kết nối Postgres thay MemoryStore | ✅ Done |
| `symflow-api` — WebSocket replay agent_logs từ DB | ✅ Done |
| `symflow-api` — `GET /api/runs` (list runs) | ✅ Done |
| `symflow-api` — `DELETE /api/flows/:id` | ✅ Done |
| `symflow-cli` — `symflow-cli run <file>` | ✅ Done — đầy đủ với event printer |
| `symflow-cli` — `symflow-cli agents` | ✅ Done |
| `symflow-web` — Flow list, editor, save, trigger run | ✅ Done |
| `symflow-web` — Run detail (steps + WebSocket live log) | ✅ Done |
| `symflow-web` — Polling fallback khi run chưa xong | ✅ Done (3s interval) |
| `symflow-web` — Dedup log entries (fingerprint) | ✅ Done |
| `symflow-web` — Navigation toàn cục | ❌ `+layout.svelte` chỉ import CSS |
| `symflow-web` — Trang `/agents` (agent catalog) | ❌ Chưa có route |
| `symflow-web` — Trang `/runs` (list runs) | ❌ Chưa có route |
| `symflow-web` — Nút "Delete flow" | ❌ Chưa có |
| `symflow-web` — WebSocket reconnect khi mất kết nối | ❌ Chỉ set `wsState = 'Disconnected'`, không retry |
| `symflow-web` — `AgentLogEvent.run_id` field mapping | ✅ Done |
| `symflow-desktop` — Desktop bundle | ❌ Chỉ có README |

---

## Việc cần làm

> Ghi chú: các mục backend P0/P1 đã được hoàn thành trong code hiện tại vẫn giữ ở đây như checklist tham chiếu lịch sử. Những mục còn lại chủ yếu là UI/UX và mở rộng.

---

### 🔴 P0 — Blocking để chạy với database thật

#### 1. Tạo SQL migrations

**Tạo mới:** `packages/symflow-store/migrations/`

```
packages/symflow-store/migrations/
  0001_create_flows.sql
  0002_create_flow_runs.sql
  0003_create_step_executions.sql
```

Schema Postgres (`flowagent_engine.md` § 3.3.1):

```sql
-- 0001
CREATE TABLE flows (
    id         VARCHAR(100) PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    dsl_script TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 0002
CREATE TABLE flow_runs (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id        VARCHAR(100) NOT NULL REFERENCES flows(id),
    status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED')),
    initial_inputs JSONB,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ
);

-- 0003
CREATE TABLE step_executions (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID         NOT NULL REFERENCES flow_runs(id),
    step_id         VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','SKIPPED')),
    resolved_inputs JSONB,
    outputs         JSONB,
    agent_logs      JSONB,
    error           TEXT,
    executed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_id)
);
CREATE INDEX idx_step_exec_run ON step_executions(run_id);
```

---

#### 2. Tạo `PgStore` struct trong `symflow-store`

**Tạo mới:** `packages/symflow-store/src/pg_store.rs`

Bọc `PgPool` và implement `symflow_core::store::Store` trait bằng cách ủy quyền sang từng hàm trong `repositories/`:

```rust
use async_trait::async_trait;
use sqlx::PgPool;
use symflow_core::store::Store;
use crate::repositories::{flows, flow_runs, step_executions};

pub struct PgStore { pool: PgPool }

impl PgStore {
    pub fn new(pool: PgPool) -> Self { PgStore { pool } }
}

#[async_trait]
impl Store for PgStore {
    async fn upsert_flow(&self, id: &str, name: &str, dsl_script: &str) -> Result<(), StoreError> {
        flows::upsert_flow(&self.pool, id, name, dsl_script).await
    }
    // ... delegate toàn bộ theo hàm đã có trong repositories/
}
```

Export ra `lib.rs`:
```rust
pub mod pg_store;
pub use pg_store::PgStore;
```

---

#### 3. Wire Postgres vào `symflow-api` (với fallback MemoryStore)

**Sửa:** `services/symflow-api/src/app.rs` và `services/symflow-api/src/main.rs`

Bước 1 — đổi `AppState.store` thành trait object:
```rust
// app.rs
pub struct AppState {
    pub store: Arc<dyn Store>,   // đổi từ Arc<MemoryStore>
    pub bus: EventBus,
    pub sandbox_dir: PathBuf,
}
```

Bước 2 — trong `main.rs` thay TODO comment:
```rust
let store: Arc<dyn Store> = match std::env::var("DATABASE_URL") {
    Ok(db_url) => {
        let pool = PgPool::connect(&db_url).await
            .context("failed to connect to DATABASE_URL")?;
        sqlx::migrate!("../../packages/symflow-store/migrations")
            .run(&pool).await
            .context("migrations failed")?;
        Arc::new(PgStore::new(pool))
    }
    Err(_) => {
        tracing::warn!("DATABASE_URL not set — using in-memory store (data lost on restart)");
        Arc::new(MemoryStore::new())
    }
};
```

Bước 3 — cập nhật `routes.rs` để dùng `Arc<dyn Store>` thay vì `Arc<MemoryStore>` ở mọi nơi gọi `state.store`.

---

### 🟠 P1 — Tính năng đang thiếu quan trọng

#### 4. WebSocket replay agent_logs từ DB

**Sửa:** `services/symflow-api/src/realtime.rs`

Thay `TODO` comment bằng logic replay. Trước khi vào `loop`, truy vấn steps đã lưu và forward ngược về client mới kết nối:

```rust
async fn handle_ws(socket: WebSocket, state: AppState, run_id: Uuid) {
    let steps = state.store.list_steps(run_id).await.unwrap_or_default();
    let (mut sender, mut receiver) = socket.split();

    // Replay
    for step in &steps {
        if let Some(serde_json::Value::Array(entries)) = &step.agent_logs {
            for entry in entries {
                if let Ok(event) = serde_json::from_value::<RunEvent>(entry.clone()) {
                    if send_json(&mut sender, &event).await.is_err() { return; }
                }
            }
        }
    }

    // Live events từ broadcast bus
    let mut rx = state.bus.subscribe();
    loop { /* ... giữ nguyên logic hiện tại */ }
}
```

Lưu ý: cần `state.store` có trong scope (hiện `handle_ws` nhận `state: AppState` — ok).

---

#### 5. Thêm endpoint `GET /api/runs` — list all runs

**Sửa:** `services/symflow-api/src/routes.rs` — thêm route mới:
```rust
.route("/api/runs", axum::routing::get(list_runs))
```

Implement handler:
```rust
pub async fn list_runs(State(state): State<AppState>) -> Result<impl IntoResponse, ApiError> {
    // store.list_runs() — cần thêm method này vào Store trait + MemoryStore + PgStore
}
```

Cần thêm vào `Store` trait:
```rust
async fn list_runs(&self) -> Result<Vec<RunRecord>, StoreError>;
```

Và implement trong cả `MemoryStore` và `PgStore` (query: `SELECT ... FROM flow_runs ORDER BY created_at DESC`).

---

#### 6. Fix field mapping camelCase/snake_case trong WebSocket events

**Vấn đề:** Backend serialize `RunEvent` với field `run_id` (snake_case), nhưng `AgentLogEvent` trong FE TypeScript dùng `runId` (camelCase).

Kiểm tra `packages/symflow-core/src/events.rs` xem `RunEvent` serialize ra format nào.

**Nếu backend dùng snake_case** → sửa FE type:
```typescript
// symflow.ts
export interface AgentLogEvent {
  run_id?: string;   // thay vì runId
  step_id?: string;  // thay vì stepId
  // ...
}
```

Và sửa tất cả chỗ dùng `log.runId` / `log.stepId` trong `ReactLogView.svelte` + `run/[id]/+page.svelte`.

**Nếu muốn giữ camelCase ở FE** → thêm `#[serde(rename_all = "camelCase")]` trên `RunEvent` struct ở backend.

Chọn một hướng nhất quán và áp dụng xuyên suốt.

---

### 🟡 P2 — UX/DX cải thiện

#### 7. Navigation toàn cục trong `symflow-web`

**Sửa:** `services/symflow-web/src/routes/+layout.svelte`

Thêm nav bar đơn giản với các link:
```svelte
<nav>
  <a href="/flows">Flows</a>
  <a href="/agents">Agents</a>
</nav>
<slot />
```

Hoặc tích hợp nav vào `AppShell.svelte` để tất cả page đều thừa hưởng.

---

#### 8. Trang `/agents` — Agent Catalog UI

**Tạo mới:**
- `services/symflow-web/src/routes/agents/+page.ts`
- `services/symflow-web/src/routes/agents/+page.svelte`

Thêm vào `client.ts`:
```typescript
export async function listAgents(): Promise<AgentCatalog[]> {
  const response = await fetch(createUrl('/api/agents'));
  return parseResponse<AgentCatalog[]>(response);
}
```

Thêm type vào `symflow.ts`:
```typescript
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: unknown;
}
export interface AgentCatalog {
  id: string;
  name: string;
  description: string;
  tools: ToolSchema[];
}
```

Trang list: card mỗi agent hiển thị `id`, `name`, `description`, số tools.
Có thể expand inline để xem `inputSchema` từng tool (accordion).

---

#### 9. Trang `/runs` — Run list

**Tạo mới:**
- `services/symflow-web/src/routes/runs/+page.ts`
- `services/symflow-web/src/routes/runs/+page.svelte`

Phụ thuộc vào việc #5 (endpoint `GET /api/runs` ở backend). Hiển thị bảng với cột:
`Run ID` | `Flow ID` | `Status` | `Created` | `Duration` — mỗi dòng link tới `/runs/:id`.

---

#### 10. WebSocket reconnect tự động

**Sửa:** `services/symflow-web/src/lib/components/ReactLogView.svelte`

Hiện tại khi socket đóng chỉ set `wsState = 'Disconnected'`. Thêm exponential backoff reconnect:

```typescript
let retries = 0;
const MAX_RETRIES = 4;

function connect() {
  const socket = new WebSocket(wsUrl);
  socket.onclose = () => {
    if (retries < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** retries, 10000);
      retries++;
      wsState = `Reconnecting in ${delay / 1000}s...`;
      setTimeout(connect, delay);
    } else {
      wsState = 'Disconnected';
    }
  };
  // ...
}
```

Sau khi reconnect thành công, backend replay (việc #4) sẽ đảm bảo log không bị mất.

---

#### 11. Nút "Delete flow"

**Backend — sửa:** `services/symflow-api/src/routes.rs`
```rust
.route("/api/flows/:id", axum::routing::delete(delete_flow))
```

Cần thêm `delete_flow` vào `Store` trait, `MemoryStore`, `PgStore`, và SQL:
```sql
DELETE FROM flows WHERE id = $1;
```

**Frontend — sửa:** `services/symflow-web/src/routes/flows/shared-editor.svelte`

Thêm nút "Delete" chỉ hiển thị khi đang edit flow có sẵn (`flowId` không rỗng). Dialog xác nhận trước khi gọi API. Redirect về `/flows` sau khi xóa.

---

### 🟢 P3 — Tương lai

#### 12. Parallel step execution

`executor.rs` hiện chạy topo-order tuyến tính. Refactor sang chạy theo **tầng (levels)**: các step không phụ thuộc nhau trong cùng tầng dùng `tokio::JoinSet` chạy đồng thời. Xem mô tả trong `flowagent_engine.md` § 3.5.

---

#### 13. LLM native function calling

Chuyển `agent/runtime.rs` từ parse text `Thought/Action` sang **structured function calling** của OpenAI API. Giảm lỗi parse, tăng độ tin cậy. Xem ghi chú trong `flowagent_engine.md` § 3.8.

---

#### 14. MariaDB parity

Tạo `packages/symflow-store/migrations-mysql/` với schema MariaDB (`flowagent_engine.md` § 3.3.2). Kiểm tra feature `sqlx/mysql` trong `Cargo.toml`.

---

#### 15. `symflow-desktop` — Desktop bundle

Đóng gói `symflow-api` binary như sidecar trong app desktop (Tauri hoặc tương đương). `services/symflow-desktop/README.md` hiện trống.

---

## Top 6 làm ngay

| # | Việc | File(s) chính |
|---|---|---|
| 1 | Tạo SQL migrations Postgres | `packages/symflow-store/migrations/*.sql` |
| 2 | Tạo `PgStore` struct (impl `Store` trait) | `packages/symflow-store/src/pg_store.rs` |
| 3 | Wire Postgres vào API, đổi `AppState.store` thành `Arc<dyn Store>` | `services/symflow-api/src/app.rs` + `main.rs` |
| 4 | Replay agent_logs qua WebSocket | `services/symflow-api/src/realtime.rs` |
| 5 | Thêm `GET /api/runs` (list runs) | `services/symflow-api/src/routes.rs` + Store trait |
| 6 | Fix camelCase/snake_case mismatch giữa `RunEvent` và `AgentLogEvent` | `packages/symflow-core/src/events.rs` + `services/symflow-web/src/lib/types/symflow.ts` |
