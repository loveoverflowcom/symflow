# Refactor: Flow Editor từ Node Graph sang Block-based Editor

## Trạng thái hiện tại (baseline)

### Backend (`symflow-core`)

DSL hiện tại là flat list of steps với `needs` array để khai báo dependency:

```json
{
  "flow_id": "my-flow",
  "name": "My flow",
  "steps": [
    { "id": "fetch", "type": "web_scraper", "with": { "url": "..." } },
    { "id": "summarize", "needs": ["fetch"], "type": "ai_agent", "with": { "goal": "..." } }
  ]
}
```

Backend pipeline đã hoạt động đầy đủ:
- `dsl.rs` → parse JSON/YAML thành `Flow { steps: Vec<Step> }`
- `compiler.rs` → build DAG, topo-sort, tính `levels` cho parallel execution
- `executor.rs` → chạy theo topo-order, cô lập lỗi, emit events qua `EventBus`

Step types hiện có: `manual_trigger`, `web_scraper`, `local_file_reader`, `ai_agent` — hiện hardcoded trong `dsl.rs` và `executor.rs`.

**Backend cần thay đổi trong refactor này** — xem mục "Thay đổi backend" bên dưới.

### Frontend (`symflow-web`)

Editor hiện tại dùng **@xyflow/svelte** (React Flow port):
- `flow-graph.ts` — `dslToGraph()` / `graphToDsl()` chuyển đổi qua lại giữa `DslFlow` ↔ nodes/edges
- `FlowCanvas.svelte` — viewport kéo thả, zoom, snap
- `NodePalette.svelte` — panel bên trái để kéo node vào canvas
- `NodeConfigPanel.svelte` — panel cấu hình khi chọn node
- `shared-editor.svelte` — ghép canvas + JSON editor + run panel

---

## Mục tiêu refactor

Thay thế canvas kéo dây bằng **Block Editor** dạng cây có thể lồng nhau.

Lý do:
1. Node Graph phù hợp khi luồng phức tạp, nhiều nhánh song song, cần nhìn toàn cục. Với flows tuyến tính hoặc có ít nhánh, kéo dây thêm thao tác thừa.
2. Block Editor đọc hiểu nhanh hơn — cấu trúc là cây nên nhìn vào biết ngay thứ tự thực thi.
3. Dễ hỗ trợ control flow lồng nhau (`if`, `foreach`, `try/catch`) sau này mà không phải vẽ sub-graph phức tạp.

**JSON DSL không đổi.** Block Editor chỉ là cách edit DSL khác — source of truth vẫn là JSON được lưu trong DB.

---

## Phạm vi thay đổi

### Không thay đổi
- `symflow-api` REST + WebSocket endpoints (trừ thêm endpoint mới cho tasks)
- Database schema (flows, flow_runs, step_executions)
- `FlowDetail.dsl_script` — vẫn là JSON string
- JSON editor (textarea raw DSL) vẫn giữ song song với Block Editor

### Thay đổi backend (`symflow-core` + `symflow-api`)

**B1 — Task Registry (thay thế hardcoded step types)**

Hiện tại `dsl.rs` hardcode `StepType` enum và `executor.rs` match cứng từng loại. Cần tách thành Task Registry để:
- Backend tự biết danh sách tasks đang có
- Có endpoint trả về danh sách cho FE hiển thị trong StepPalette
- Dễ bổ sung task mới mà không sửa compiler

```rust
// packages/symflow-core/src/tasks/mod.rs
pub trait Task: Send + Sync {
    fn name(&self) -> &str;           // "web_scraper"
    fn label(&self) -> &str;          // "Web Scraper"
    fn input_schema(&self) -> Value;  // JSON Schema
    fn output_schema(&self) -> Value;
}

pub struct TaskRegistry { ... }
impl TaskRegistry {
    pub fn register(&mut self, task: Arc<dyn Task>)
    pub fn list(&self) -> Vec<TaskMeta>   // trả về cho API
    pub fn get(&self, name: &str) -> Option<Arc<dyn Task>>
}
```

Các system tasks tích hợp sẵn đăng ký vào registry khi khởi động:
`manual_trigger`, `web_scraper`, `local_file_reader`, `ai_agent`

Sau này thêm task mới (crawler, gmail, postgres, v.v.) chỉ cần implement `Task` trait và register — không sửa compiler.

**B2 — API endpoint `GET /api/tasks`**

Trả về danh sách tasks đã đăng ký để FE hiển thị trong StepPalette:

```json
[
  {
    "name": "web_scraper",
    "label": "Web Scraper",
    "input_schema": { "url": { "type": "string" } },
    "output_schema": { "html": { "type": "string" } }
  },
  ...
]
```

**B3 — Primitive mới cho control flow**

Bổ sung vào `dsl.rs` và `executor.rs` — không thay đổi flat `steps[]` schema, chỉ thêm `type` mới:

| Primitive | Ý nghĩa | `with` fields |
|---|---|---|
| `if` | Rẽ nhánh điều kiện | `condition`, `then: steps[]`, `else: steps[]` |
| `foreach` | Lặp qua array | `items`, `as`, `steps: steps[]` |
| `parallel` | Chạy song song | `branches: steps[][]` |
| `try` | Bọc lỗi | `steps: steps[]`, `catch: steps[]` |

Compiler xử lý nested steps bằng cách flatten hoặc build sub-DAG. Executor nhận biết primitive qua `type` và thực thi tương ứng.

Thứ tự ưu tiên: `parallel` → `if` → `foreach` → `try/catch`

### Thay đổi trong `symflow-web`

| Xóa | Thay bằng |
|---|---|
| `lib/components/flow-canvas/FlowCanvas.svelte` | `lib/components/block-editor/BlockEditor.svelte` |
| `lib/components/flow-canvas/FlowCanvasViewport.svelte` | — |
| `lib/components/flow-canvas/NodePalette.svelte` | `lib/components/block-editor/StepPalette.svelte` |
| `lib/components/flow-canvas/NodeConfigPanel.svelte` | `lib/components/block-editor/StepConfigPanel.svelte` |
| `lib/components/flow-canvas/nodes/*.svelte` | `lib/components/block-editor/blocks/*.svelte` |
| `lib/utils/flow-graph.ts` (dslToGraph / graphToDsl) | `lib/utils/dsl-tree.ts` |
| dependency `@xyflow/svelte` | không có dependency mới |
| Tab **Skills** trong sidebar | — (xóa hẳn) |
| Tab **Artifacts** trong sidebar | — (xóa hẳn) |

---

## Thiết kế Block Editor

### Mô hình dữ liệu

Block Editor làm việc trực tiếp trên `DslFlow` (type đã có trong `flow-graph.ts`, giữ nguyên hoặc chuyển sang file mới):

```typescript
// lib/utils/dsl-tree.ts
export interface DslStep {
  id: string;
  type: string;
  needs?: string[];
  with?: Record<string, unknown>;
}

export interface DslFlow {
  flow_id: string;
  name: string;
  steps: DslStep[];
}
```

Không cần convert sang nodes/edges nữa. Block Editor nhận `DslFlow`, render trực tiếp, emit `DslFlow` mới khi có thay đổi.

### Giao diện

```
┌─────────────────────────────────────────────┐
│  + Add step  [▼ chọn từ danh sách tasks]     │
├─────────────────────────────────────────────┤
│ ① Manual Trigger          [id: receive_input]│
│   └─ message: "Hello"              [⚙] [🗑] │
├─────────────────────────────────────────────┤
│ ② Web Scraper             [id: fetch_page]   │
│   └─ url: "https://..."            [⚙] [🗑] │
├─────────────────────────────────────────────┤
│ ③ AI Agent                [id: summarize]    │
│   └─ goal: "Tóm tắt bài viết"     [⚙] [🗑] │
└─────────────────────────────────────────────┘
```

- Mỗi step là một block card, xếp theo thứ tự trong `steps[]`
- Kéo thả để sắp xếp lại thứ tự (dùng HTML5 drag-and-drop, không cần thư viện)
- Click `⚙` để mở inline config panel bên phải (hoặc expand inline)
- `needs` được tự động suy ra từ thứ tự nếu không khai báo tường minh
- Danh sách task trong "Add step" lấy từ `GET /api/tasks` — không hardcode trong FE

### Components

```
lib/components/block-editor/
  BlockEditor.svelte         # container chính, nhận DslFlow, emit onChange
  StepBlock.svelte           # một step card (drag handle, type badge, config summary)
  StepConfigPanel.svelte     # form config cho step đang chọn
  StepPalette.svelte         # dropdown/menu "Add step" với các type
  blocks/
    ManualTriggerBlock.svelte   # config fields đặc thù cho manual_trigger
    WebScraperBlock.svelte      # config fields cho web_scraper
    FileReaderBlock.svelte      # config fields cho local_file_reader
    AiAgentBlock.svelte         # config fields cho ai_agent
```

`BlockEditor.svelte` interface:

```svelte
<BlockEditor
  dsl={parsedDsl}
  flowId={flowId}
  flowName={name}
  disabled={isSaving || isRunning}
  onDslChange={(newDsl) => { dslScript = JSON.stringify(newDsl, null, 2); }}
/>
```

Giống `FlowCanvas.svelte` hiện tại — `shared-editor.svelte` chỉ cần đổi import.

---

## Kế hoạch triển khai

### Phase 1 — Hạ tầng (không phá vỡ hiện trạng)

**1.1** Tạo `lib/utils/dsl-tree.ts`
- Di chuyển types `DslStep`, `DslFlow` từ `flow-graph.ts` sang đây
- Xóa `dslToGraph`, `graphToDsl`, `topoSort`, `mapStepTypeToNodeType` khỏi `flow-graph.ts`
- Cập nhật imports trong `shared-editor.svelte`

**1.2** Tạo `BlockEditor.svelte` (stub)
- Nhận cùng props như `FlowCanvas.svelte`
- Render danh sách steps đơn giản (text only), không có interaction
- Chưa kết nối vào editor chính

**Kiểm tra:** Build pass, editor vẫn dùng FlowCanvas, không có regression.

---

### Phase 2 — Block Editor cơ bản

**2.1** Implement `StepBlock.svelte`
- Hiển thị: index, type badge (màu theo loại), step id, config summary (key đầu tiên của `with`)
- Drag handle để reorder
- Nút xóa step

**2.2** Implement `StepConfigPanel.svelte`
- Form chung: input field cho `id`, dropdown cho `type`, textarea cho `with` (JSON)
- Sau đó tách thành specific blocks (phase 3)

**2.3** Implement `StepPalette.svelte`
- Dropdown "＋ Add step" load danh sách từ `GET /api/tasks`
- Hiển thị label và mô tả ngắn cho từng task
- Thêm step mới vào cuối `steps[]` với default config từ `input_schema` trả về

**2.4** Kết nối vào `shared-editor.svelte`
- Thay `<FlowCanvas ...>` bằng `<BlockEditor ...>`
- Giữ JSON editor song song phía dưới (đồng bộ hai chiều)

**Kiểm tra:** Có thể tạo, sắp xếp lại, xóa step. JSON editor phản ánh thay đổi. Save và run vẫn hoạt động.

---

### Phase 3 — Config forms đặc thù từng step type

**3.1** `ManualTriggerBlock.svelte` — free-form key/value editor cho `with`

**3.2** `WebScraperBlock.svelte` — input field cho `url`

**3.3** `FileReaderBlock.svelte` — input field cho `path` (và alias `filename`)

**3.4** `AiAgentBlock.svelte` — fields cho `model`, `goal`, `context`, `max_iterations`, `allowed_tools`

**3.5** Fallback generic block — với task chưa có block riêng, render JSON textarea cho `with` dựa trên `input_schema` từ API

**Kiểm tra:** Mỗi step type render đúng form, thay đổi trong form cập nhật DSL, không mất dữ liệu khi chuyển step.

---

### Phase 4 — Dọn dẹp

**4.1** Xóa `lib/components/flow-canvas/` sau khi Phase 2-3 ổn định

**4.2** Xóa dependency `@xyflow/svelte` khỏi `package.json`

**4.3** Xóa `lib/utils/flow-graph.ts` nếu không còn import nào

**4.4** Xóa i18n keys liên quan đến canvas: `flowCanvas`, `emptyCanvas`, `emptyCanvasDescription`, `canvasKeyboardHint`, `invalidDslForCanvas`, `invalidDslForCanvasDescription`

**4.5** Cập nhật `dragToCanvas` → `addStep` trong i18n (hoặc xóa nếu không dùng)

**4.6** Xóa tab **Skills** và tab **Artifacts** khỏi sidebar (`AppShell.svelte`) và xóa các route tương ứng (`/skills`, `/artifacts`)

**4.7** Xóa i18n keys liên quan: `skills`, `skillsSubtitle`, `noSkillsYet`, `noSkillsDescription`, và toàn bộ `skillFeature*`, `skillsConceptNote`, `artifacts`

---

## Lưu ý về navigation (sau refactor)

Sidebar sẽ còn lại:
- **Home**
- **Agents** (placeholder)
- **Connectors** (placeholder)
- **Workflows** (active)
- **Settings**

Tab **Skills** và **Artifacts** bị xóa. Khái niệm "skill" sau này có thể quay lại dưới dạng một loại task đặc biệt trong Task Registry, không cần tab riêng.

Tab **Workflows** → icon nên phân biệt rõ với Connectors — cập nhật icon trong `SidebarMenuItem.svelte`.

---

## Rủi ro và lưu ý

| Rủi ro | Biện pháp |
|---|---|
| JSON editor và Block Editor mất đồng bộ | Dùng một source of truth duy nhất: `dslScript` string. Block Editor parse mỗi khi cần render, emit JSON string mới mỗi khi thay đổi |
| Drag-and-drop reorder làm sai `needs` | Sau khi reorder, recalculate `needs` theo thứ tự mới — giống logic trong `graphToDsl()` hiện tại |
| Mất dữ liệu `needs` tường minh khi người dùng đặt tay | Hiển thị `needs` field trong config panel để override thủ công |
| Build break khi xóa `@xyflow/svelte` | Xóa cuối cùng, sau khi toàn bộ import đã được thay thế |
| Task Registry làm vỡ executor hiện tại | Implement registry song song với code cũ, migrate từng task, xóa hardcode sau khi test pass |
| `GET /api/tasks` chưa có khi FE cần | FE dùng fallback hardcoded list tạm thời trong Phase 2, switch sang API khi BE xong |
