# FlowAgent Engine — Phân tích Vision, Requirements & Technical Design

> **Phiên bản:** Demo Nội bộ (Proof of Concept)
> **Kiến trúc:** Text-based DSL (Domain-Specific Language) + AI Agent tự trị tại Local
> **Tech stack ưu tiên:** Backend Rust (async/Tokio) + PostgreSQL (hoặc MariaDB) · Frontend Flutter (một codebase cho Web → Desktop → Mobile)
> **Định danh:** Zero-Auth (không đăng ký/đăng nhập)
> **Thời điểm khởi tạo:** Tháng 07, 2026

---

## 0. Tóm tắt điều hành & Quyết định Tech Stack

FlowAgent Engine là một bộ máy tự động hóa chạy cục bộ (local-first) kết hợp hai triết lý:

- **Luồng tuyến tính có kiểm soát** (kiểu Zapier/n8n): các bước cố định, phụ thuộc rõ ràng qua `needs`, tạo thành đồ thị có hướng không chu trình (DAG).
- **Suy luận phi cấu trúc** (kiểu Gumloop): một nút `ai_agent` nhận `goal` + `context` và tự chạy vòng lặp ReAct, tự gọi công cụ cục bộ để hoàn thành mục tiêu.

Tài liệu này chuyển đặc tả gốc (vốn giả định SQLite/Python-agnostic) sang **stack Rust + PostgreSQL/MariaDB** cho backend, và bổ sung **Frontend Flutter** (một codebase cho Web → Desktop → Mobile): chọn crate/package, phác thảo module, thiết kế schema cho cả hai hệ CSDL, mô tả thuật toán biên dịch DAG + vòng lặp Agent, và định nghĩa hợp đồng API giữa FE ↔ BE.

### 0.1. Vì sao chọn Rust

| Tiêu chí | Lý do phù hợp với FlowAgent |
|---|---|
| An toàn bộ nhớ & thread | Bộ máy thực thi chạy nhiều bước song song (các nhánh DAG độc lập); Rust loại bỏ data race tại compile-time. |
| Async hiệu năng cao | Gọi LLM API và web scraping đều I/O-bound; runtime `tokio` xử lý hàng nghìn tác vụ concurrent với chi phí thấp. |
| Binary tĩnh, không runtime nặng | Phù hợp "local-first": ship một file thực thi duy nhất, không cần cài Python/Node interpreter. |
| Kiểu dữ liệu mạnh cho DSL | `serde` + enum tagged giúp parse và validate DSL chặt chẽ, bắt lỗi cấu hình sớm. |
| Xử lý lỗi tường minh | `Result<T, E>` ép buộc xử lý mọi trạng thái thất bại — trực tiếp phục vụ yêu cầu "cô lập lỗi từng bước". |

### 0.2. Vì sao PostgreSQL (mặc định) hoặc MariaDB

Đặc tả gốc dùng SQLite cho demo. Ở đây nâng lên **PostgreSQL làm mặc định** vì:

- Kiểu `JSONB` gốc để lưu `initial_inputs`, `resolved_inputs`, `outputs`, `agent_logs` mà vẫn query được.
- Kiểu `UUID` gốc + hàm `gen_random_uuid()`.
- `TIMESTAMPTZ`, ràng buộc `CHECK`, và transaction mạnh phục vụ cô lập trạng thái bước.

**MariaDB** là phương án thay thế (cho đội quen MySQL): dùng `JSON` (LONGTEXT có validate), `CHAR(36)` cho UUID, `ENUM`/`VARCHAR` cho status. Tài liệu cung cấp schema cho cả hai.

> Với chế độ demo cực nhẹ vẫn có thể fallback SQLite, nhưng để đồng nhất production-path ta chọn Postgres/MariaDB ngay từ đầu vì `sqlx` hỗ trợ cả ba qua cùng một API.

### 0.3. Bảng crate đề xuất

| Vai trò | Crate | Ghi chú |
|---|---|---|
| Async runtime | `tokio` | `features = ["full"]` |
| HTTP server (API nạp/chạy flow) | `axum` | Nhẹ, gắn liền hệ sinh thái tokio/tower |
| Truy vấn CSDL | `sqlx` | Compile-time checked query; hỗ trợ Postgres + MySQL/MariaDB + SQLite |
| Migrations | `sqlx-cli` / `sqlx::migrate!` | Version hóa schema |
| Serde | `serde`, `serde_json`, `serde_yaml` | Parse DSL YAML/JSON, encode outputs |
| Đồ thị & topo-sort | `petgraph` | Xây DAG, phát hiện chu trình, `toposort` |
| HTTP client (LLM + scraper) | `reqwest` | `features = ["json", "stream"]` |
| Parse HTML (web_scraper) | `scraper` | Trích văn bản thô từ DOM |
| LLM client | `async-openai` *(hoặc reqwest thuần)* | Chat completions + tool/function calling |
| UUID | `uuid` | `features = ["v4", "serde"]` |
| Thời gian | `chrono` hoặc `time` | Timestamp |
| Logging/observability | `tracing`, `tracing-subscriber` | Log có cấu trúc (span cho từng step & vòng ReAct) |
| Error | `thiserror` (lib), `anyhow` (bin) | Lỗi tường minh theo domain |
| Regex (variable resolution) | `regex` | Bắt token `{{steps.*}}` |
| Sanitize path | `std::path` + kiểm tra thủ công | Chống path traversal trong sandbox |
| Config | `figment` hoặc `config` + `dotenvy` | Nạp `SANDBOX_DIR`, API key |
| HTTP server + WebSocket (phục vụ FE) | `axum` + `tokio-tungstenite` | REST cho CRUD flow/run; WS/SSE cho log ReAct realtime |
| CORS | `tower-http` (`CorsLayer`) | Cho phép Flutter Web gọi backend local |

### 0.4. Vì sao Frontend dùng Flutter

Yêu cầu là **một codebase FE chạy được Web ngay, sau này build Desktop/Mobile**. Flutter đáp ứng trực tiếp: cùng một mã Dart build ra Web, Windows/macOS/Linux và iOS/Android mà không phải viết lại UI.

| Tiêu chí | Lý do phù hợp với FlowAgent |
|---|---|
| Đa nền tảng một codebase | Web (giai đoạn đầu) → Desktop/Mobile về sau, không đổi ngôn ngữ/UI framework. |
| Desktop local-first | Bản Desktop có thể **bundle backend Rust như một sidecar process**, ship thành một app cài đặt duy nhất — khớp triết lý local-first. |
| Realtime log Agent | Widget reactive + stream WebSocket hiển thị trực tiếp vòng ReAct (Thought/Action/Observation) — phục vụ NFR-2. |
| Editor DSL | Có widget code-editor (YAML highlight) để soạn/validate DSL ngay trong app, giữ DSL là nguồn sự thật. |
| Tách biệt sạch với backend | FE chỉ nói chuyện với backend Rust qua HTTP/WS JSON; hợp đồng API rõ ràng, dễ test độc lập. |

Bảng package Flutter đề xuất — chi tiết ở **mục 3.15**.

---

## 1. TÀI LIỆU TẦM NHÌN (VISION)

### 1.1. Tổng quan sản phẩm

FlowAgent Engine là nền tảng tự động hóa xử lý dữ liệu **cấu hình bằng văn bản** (text-based). Thay vì đầu tư sớm vào Canvas UI kéo-thả phức tạp, hệ thống dùng DSL tối giản (YAML/JSON) để lập trình luồng, và nhúng AI Agent tự trị trực tiếp vào hệ thống tệp cục bộ. Lõi thực thi là một binary Rust; phía trên là một **client Flutter** (Web trước, Desktop/Mobile sau) đóng vai giao diện soạn DSL, kích hoạt luồng và quan sát log Agent realtime. FE không thay thế DSL — nó là lớp trình bày trên chính DSL và API.

### 1.2. Vấn đề giải quyết

- **Zapier truyền thống** rẽ nhánh cực kỳ cồng kềnh khi gặp dữ liệu phi cấu trúc (văn bản thô, tài liệu lộn xộn).
- **Gumloop** mạnh AI-native nhưng việc dựng canvas trực quan làm chậm quá trình thử nghiệm thuật toán Core Engine ở giai đoạn demo.
- **FlowAgent** đứng ở giữa: định nghĩa khung dữ liệu thô chạy qua các bước cố định, rồi "ủy quyền toàn phần" cho AI Agent tự suy luận và tự gọi Tools tại local — không cần vẽ sơ đồ.

### 1.3. Định vị so với công cụ hiện có

| Tiêu chí | Zapier | n8n | Gumloop | **FlowAgent (bản này)** |
|---|---|---|---|---|
| Giao diện | UI kéo-thả | UI kéo-thả | Canvas AI-native | **DSL văn bản + client Flutter (Web/Desktop/Mobile)** |
| Triển khai | SaaS | Cloud/Self-host | SaaS | **Local-first: backend Rust + FE Flutter** |
| Dữ liệu phi cấu trúc | Yếu | Trung bình | Mạnh | **Mạnh (qua nút ai_agent)** |
| Tính phí | Per-task | Per-execution / free self-host | Credit-based | **Miễn phí (chỉ tốn token LLM)** |
| Điểm mạnh cốt lõi | Tích hợp SaaS | Logic phức tạp + code | Reasoning + browser | **Kiểm soát DAG + Agent tự trị nhúng local** |

Kết luận định vị: FlowAgent lấy **tính kiểm soát tuyến tính của Zapier/n8n** ghép với **lớp nhận thức (cognitive layer) của Gumloop**. Điểm khác biệt là **DSL-first**: nguồn sự thật luôn là văn bản, còn client Flutter là lớp UI mỏng phủ lên trên (không phải canvas kéo-thả nặng nề). Nhờ đó vẫn giữ tốc độ thử nghiệm Core Engine mà lại có giao diện dùng được ngay trên Web và về sau là Desktop/Mobile.

### 1.4. Nguyên tắc thiết kế (Design Principles)

1. **Local-first, zero-auth.** Mọi thứ chạy trên máy dev; không có lớp user/tenant nào làm phân tán nguồn lực.
2. **Cô lập & fail-safe.** Một bước lỗi không được làm hỏng bước khác; hậu duệ của nó chuyển sang `SKIPPED`/`FAILED`.
3. **Quan sát được (Observability).** Mọi vòng suy nghĩ của Agent (Thought → Action → Observation) phải in ra terminal và lưu DB để debug.
4. **An toàn hệ thống tệp.** Agent chỉ được ghi trong `SANDBOX_DIR`; mọi `filename` bị sanitize chống path traversal.
5. **DSL là hợp đồng.** DSL được validate chặt bằng kiểu Rust; lỗi cấu hình phải lộ ra ở compile-time của flow (parse), không phải runtime.

### 1.5. Phạm vi MVP & Ngoài phạm vi

**Trong phạm vi (MVP):**
- Thực thi hoàn toàn local.
- Nút nội bộ: `manual_trigger`, `web_scraper`, `local_file_reader`.
- Nút nhận thức: `ai_agent` với vòng ReAct.
- Local tools: `local_file_writer`, `string_analyzer`.
- Agent packs (gói năng lực, mục 3.16): 📄 PDF (`pdf`), 🌐 Scraper (`scraper`), 📊 Chart (`chart`) — cấp cho `ai_agent` qua `allowed_tools`.
- Lưu trạng thái + logs vào PostgreSQL/MariaDB; file output ra `SANDBOX_DIR`.
- Backend REST/WebSocket (`axum`) cho CRUD flow, kích hoạt run, và stream log realtime.
- **FE Flutter (target Web trước tiên):** danh sách flow, editor DSL (YAML) có validate, nút Run, màn theo dõi run + log ReAct realtime, xem file output.

**Ngoài phạm vi (MVP):**
- Không tích hợp API bên thứ ba (Google Docs, Slack, Salesforce…).
- **Không có Canvas kéo-thả** (FE chỉ soạn DSL dạng văn bản + bảng trạng thái; canvas là hướng tương lai).
- Chưa build/đóng gói bản Desktop/Mobile ở MVP (kiến trúc đã sẵn sàng, nhưng target đầu tiên là Web).
- Không có auth/multi-tenant/billing.
- Không có scheduler định kỳ (cron) — chỉ chạy theo trigger thủ công.

---

## 2. TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD)

### 2.1. Personas & User stories

- **Persona chính — Kỹ sư Core Engine (solo dev).**
  - *"Là dev, tôi muốn khai báo luồng bằng một file YAML để chạy nhanh mà không phải dựng UI."*
  - *"Là dev, tôi muốn xem toàn bộ chuỗi suy nghĩ của Agent trên terminal để debug vì sao nó chọn tool sai."*
  - *"Là dev, tôi muốn một bước lỗi không làm sập cả luồng và tôi biết chính xác bước nào fail."*

### 2.2. Yêu cầu chức năng (Functional Requirements)

#### Phân hệ 1 — Bộ dịch luồng tuyến tính (Linear Workflow Engine via DSL)

- **FR-1.1 Step Definition.** Khai báo mỗi bước bằng `id`, `type`, `with` (tham số), `needs` (phụ thuộc) trong file văn bản.
- **FR-1.2 Dependency Management.** Từ khóa `needs` chỉ định bước chỉ chạy sau khi (các) bước phụ thuộc `COMPLETED`. Tập hợp `needs` tạo DAG.
- **FR-1.3 Data Resolution.** Bước sau truy cập output bước trước qua cú pháp `{{steps.step_id.output_field}}`.
- **FR-1.4 Core Built-in Steps.**
  - `manual_trigger`: nhận tham số cấu hình ban đầu bằng tay.
  - `web_scraper`: nhận URL, cào văn bản thô.
  - `local_file_reader`: đọc tệp trong thư mục nội bộ.

#### Phân hệ 2 — Tích hợp AI Agent tự trị (Cognitive Agent Layer)

- **FR-2.1 Nút `ai_agent`.** Nhận `goal` (mục tiêu), `context` (ngữ cảnh), `model`, `allowed_tools`.
- **FR-2.2 Vòng lặp ReAct.** Agent lặp: đưa `Thought` → yêu cầu `Action` (gọi tool) → nhận `Observation` → lặp lại đến khi có `Final Answer`.
- **FR-2.3 Local Tools Registry.**
  - `local_file_writer`: tạo/ghi nội dung văn bản ra file.
  - `string_analyzer`: đếm từ / tìm từ khóa trong chuỗi.
- **FR-2.4 Giới hạn tool.** Agent chỉ được gọi tool nằm trong `allowed_tools`; gọi tool ngoài danh sách → trả `Observation` báo lỗi (không crash).
- **FR-2.5 Giới hạn vòng lặp.** Có `max_iterations` (mặc định ví dụ 10) để tránh Agent lặp vô hạn; chạm trần → bước `FAILED` với lý do rõ ràng.

### 2.3. Yêu cầu Phi chức năng (Non-Functional Requirements)

- **NFR-1 Reliability (toàn vẹn).** Trạng thái mỗi bước được cô lập trong transaction. Bước lỗi → hậu duệ (theo DAG) chuyển `SKIPPED`; bản thân bước → `FAILED`. Không có trạng thái treo mập mờ.
- **NFR-2 Observability.** In terminal + lưu DB chi tiết từng vòng ReAct (Thought/Action/Observation). Dùng `tracing` với `span` cho mỗi `run` → `step` → `iteration`.
- **NFR-3 Security (sandbox).** Ghi file bị giới hạn cứng trong `SANDBOX_DIR`; sanitize `filename` chống `../`, `..\`, đường dẫn tuyệt đối.
- **NFR-4 Performance.** Các bước không phụ thuộc nhau trong DAG có thể chạy song song (tokio tasks). Gọi LLM/scraper async, không block runtime.
- **NFR-5 Portability.** Một binary; chuyển đổi Postgres ↔ MariaDB chỉ qua config connection string + feature `sqlx`.
- **NFR-6 Determinism của Core.** Phần tuyến tính (parse, toposort, variable resolution) phải deterministic; chỉ nút Agent là non-deterministic.

### 2.4. Tiêu chí nghiệm thu (Acceptance Criteria)

- **AC-1.** Nạp `pipeline_demo.yaml` → parse thành công, phát hiện chu trình nếu có và báo lỗi biên dịch, dừng chương trình.
- **AC-2.** Chạy flow mẫu → tạo được file `ket_qua_loi.md` trong `SANDBOX_DIR`; đường dẫn tương đối được lưu vào DB.
- **AC-3.** Nếu `web_scraper` fail (URL chết), bước `ai_analyst_agent` (phụ thuộc) chuyển `SKIPPED`, `flow_run` kết thúc `FAILED`.
- **AC-4.** Bảng `step_executions.agent_logs` chứa đầy đủ chuỗi Thought/Action/Observation của lần chạy Agent.
- **AC-5.** `filename = "../../etc/passwd"` bị từ chối; file không bị ghi ra ngoài sandbox.

---

## 3. THIẾT KẾ KỸ THUẬT (TECHNICAL DESIGN)

### 3.1. Kiến trúc tổng thể

Kiến trúc 3 tầng: **FE Flutter** ↔ **Backend Rust (API)** ↔ **Core Engine + CSDL**.

```
┌──────────────────────────────────────────────────────────────┐
│  FE — Flutter (Web │ Desktop │ Mobile, cùng 1 codebase Dart)   │
│  - Danh sách/soạn flow (editor DSL YAML)                       │
│  - Nút Run, màn theo dõi run                                   │
│  - Live view log ReAct (Thought/Action/Observation)           │
└───────────────┬───────────────────────▲──────────────────────┘
   REST (dio)   │                        │  WebSocket/SSE (log realtime)
                ▼                        │
┌──────────────────────────────────────────────────────────────┐
│  Backend Rust — axum (fa-api)                                  │
│  REST: /flows, /runs, ...   +   WS: /runs/{id}/logs            │
│  (CORS cho Flutter Web; bind 127.0.0.1 — zero-auth MVP)        │
└───────────────┬──────────────────────────────────────────────┘
                ▼
        ── Core Engine (fa-core) ──
(1) DSL Parser  ── serde_yaml/serde_json ──> Flow (struct) + Vec<Step>
        │
        ▼
(2) DAG Compiler ── petgraph::toposort ──> thứ tự thực thi | lỗi chu trình
        │
        ▼
(3) Step Executor (Scheduler, tokio)
        │
        ├── (Variable Resolver) thay {{steps.x.y}} từ DB ──┐
        │                                                  │
        ▼                                                  │
[Kiểm tra Step Type]                                       │
        │                                                  │
 ┌──────┴───────────────┐                                  │
 ▼ [Tuyến tính]         ▼ [Trí tuệ: ai_agent]              │
 Core Node Exec         Agent Runtime (ReAct loop) <───────┘
 (hàm cứng, async)      │  ├─ Gọi LLM API (reqwest/async-openai)
        │               │  └─ Đòi Tool → Local Tools Exec
        │               ▼
        └───────────> Local Tools Exec (file writer / string analyzer)
                        │
                        ▼
        Lưu trạng thái + logs (PostgreSQL/MariaDB) & file ra SANDBOX_DIR
```

### 3.2. Bố cục Cargo Workspace (Rust module layout)

```
flowagent/
├── Cargo.toml                # [workspace]
├── crates/
│   ├── fa-core/              # thư viện thuần: DSL, DAG, resolver, executor, agent
│   │   ├── src/
│   │   │   ├── dsl.rs        # struct Flow/Step, parse YAML/JSON (serde)
│   │   │   ├── compiler.rs   # build DAG + toposort (petgraph)
│   │   │   ├── resolver.rs   # {{steps.x.y}} → giá trị thật
│   │   │   ├── executor.rs   # scheduler, chạy step theo thứ tự topo
│   │   │   ├── nodes/        # manual_trigger, web_scraper, local_file_reader
│   │   │   ├── agent/
│   │   │   │   ├── runtime.rs   # vòng lặp ReAct
│   │   │   │   ├── prompt.rs    # đóng gói goal+context+tool schema
│   │   │   │   ├── parser.rs    # parse Thought/Action/Final Answer
│   │   │   │   └── llm.rs       # client gọi LLM
│   │   │   ├── tools/       # local_file_writer, string_analyzer + registry
│   │   │   ├── sandbox.rs   # sanitize path, giới hạn SANDBOX_DIR
│   │   │   ├── state.rs     # enum StepStatus/RunStatus
│   │   │   └── error.rs     # thiserror
│   ├── fa-store/            # tầng lưu trữ (sqlx): flows, flow_runs, step_executions
│   │   ├── migrations/      # *.sql (Postgres) / biến thể MariaDB
│   │   └── src/lib.rs       # repository pattern
│   ├── fa-api/              # binary: HTTP server axum (REST + WebSocket) phục vụ FE
│   │   └── src/
│   │       ├── main.rs      # dựng router, CORS, state, bind 127.0.0.1
│   │       ├── routes/      # flows.rs, runs.rs (REST handlers)
│   │       ├── ws.rs        # /runs/{id}/logs — stream log ReAct realtime
│   │       └── dto.rs       # struct request/response (serde) = hợp đồng API
│   └── fa-cli/              # binary: nạp flow, chạy, in log (headless/CI)
│       └── src/main.rs
├── app/                     # FE Flutter (một codebase: web/desktop/mobile)
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart
│       ├── core/            # http client (dio), ws client, config base URL
│       ├── data/            # models (freezed) + repositories gọi fa-api
│       ├── features/
│       │   ├── flows/       # list + editor DSL (YAML)
│       │   └── runs/        # trigger + live log ReAct
│       └── routing/         # go_router
└── data/
    └── storage_sandbox/     # SANDBOX_DIR mặc định
```

Lý do tách crate:
- `fa-core` không phụ thuộc CSDL cụ thể (nhận vào một trait `Store`), giúp test độc lập và cho phép đổi Postgres ↔ MariaDB mà không đụng logic engine.
- `fa-api` (axum) và `fa-cli` là hai "mặt tiền" dùng chung `fa-core` + `fa-store`: FE Flutter gọi `fa-api`; còn `fa-cli` dùng cho chạy headless/CI. `app/` (Flutter) là repo con FE, tách hẳn khỏi Cargo workspace nhưng cùng monorepo.

### 3.3. Mô hình dữ liệu & Schema CSDL

Ba bảng phẳng như đặc tả gốc: `flows`, `flow_runs`, `step_executions`.

#### 3.3.1. PostgreSQL (mặc định)

```sql
-- 1. Nội dung file cấu hình luồng
CREATE TABLE flows (
    id          VARCHAR(100) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    dsl_script  TEXT         NOT NULL,          -- toàn bộ text YAML/JSON
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. Trạng thái từng phiên chạy tổng
CREATE TABLE flow_runs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id         VARCHAR(100) NOT NULL REFERENCES flows(id),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED')),
    initial_inputs  JSONB,                       -- tham số lúc trigger
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ
);

-- 3. Lịch sử thực thi từng bước
CREATE TABLE step_executions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID        NOT NULL REFERENCES flow_runs(id),
    step_id         VARCHAR(100) NOT NULL,       -- id step trong YAML
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','SKIPPED')),
    resolved_inputs JSONB,                       -- input sau khi resolve {{...}}
    outputs         JSONB,                       -- kết quả đầu ra
    agent_logs      JSONB,                       -- chỉ dùng cho ai_agent: chuỗi ReAct
    error           TEXT,                        -- lý do FAILED (nếu có)
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_id)
);

CREATE INDEX idx_step_exec_run ON step_executions(run_id);
```

`UNIQUE (run_id, step_id)` phục vụ trực tiếp bước Variable Resolution (`SELECT outputs ... WHERE step_id = ? AND run_id = ?`) và đảm bảo mỗi step chỉ có một bản ghi trạng thái/lần chạy.

#### 3.3.2. MariaDB (phương án thay thế)

```sql
CREATE TABLE flows (
    id          VARCHAR(100) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    dsl_script  LONGTEXT     NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flow_runs (
    id              CHAR(36)     PRIMARY KEY,     -- UUID sinh ở tầng Rust (uuid crate)
    flow_id         VARCHAR(100) NOT NULL,
    status          ENUM('PENDING','RUNNING','SUCCESS','FAILED') NOT NULL DEFAULT 'PENDING',
    initial_inputs  JSON,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at     TIMESTAMP    NULL,
    FOREIGN KEY (flow_id) REFERENCES flows(id)
);

CREATE TABLE step_executions (
    id              CHAR(36)     PRIMARY KEY,
    run_id          CHAR(36)     NOT NULL,
    step_id         VARCHAR(100) NOT NULL,
    status          ENUM('PENDING','RUNNING','COMPLETED','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
    resolved_inputs JSON,
    outputs         JSON,
    agent_logs      JSON,
    error           TEXT,
    executed_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_run_step (run_id, step_id),
    FOREIGN KEY (run_id) REFERENCES flow_runs(id)
);
```

Khác biệt chính khi port: MariaDB không có `UUID`/`JSONB` gốc → dùng `CHAR(36)` (UUID sinh phía Rust) và `JSON`; không có `gen_random_uuid()` mặc định (tùy phiên bản) → sinh UUID ở tầng ứng dụng cho nhất quán.

#### 3.3.3. Ánh xạ kiểu Rust (state machine)

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type, serde::Serialize)]
#[sqlx(type_name = "varchar")]
pub enum RunStatus { Pending, Running, Success, Failed }

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type, serde::Serialize)]
pub enum StepStatus { Pending, Running, Completed, Failed, Skipped }
```

### 3.4. Đặc tả DSL (DSL Schema)

Định dạng chuẩn `YAML` (JSON tương đương). Ví dụ `pipeline_demo.yaml`:

```yaml
flow_id: "local_research_pipeline_01"
name: "Quy trình phân tích tự động nội bộ"

steps:
  - id: trigger_init
    type: manual_trigger
    with:
      target_url: "http://localhost:8000/internal_data.html"

  - id: data_scraper
    type: web_scraper
    needs: [trigger_init]
    with:
      url: "{{steps.trigger_init.target_url}}"

  - id: ai_analyst_agent
    type: ai_agent
    needs: [data_scraper]
    with:
      model: "gpt-4o-mini"
      goal: "Phân tích tài liệu thô, tìm điểm bất thường về số liệu và lưu thành file 'ket_qua_loi.md' tại local."
      context: "{{steps.data_scraper.raw_text}}"
      max_iterations: 10
      allowed_tools:
        - "local_file_writer"
        - "string_analyzer"
```

Ánh xạ sang struct Rust (dùng `serde` với tagged enum theo trường `type`):

```rust
#[derive(Debug, serde::Deserialize)]
pub struct Flow {
    pub flow_id: String,
    pub name: String,
    pub steps: Vec<Step>,
}

#[derive(Debug, serde::Deserialize)]
pub struct Step {
    pub id: String,
    #[serde(default)]
    pub needs: Vec<String>,
    #[serde(flatten)]
    pub kind: StepKind,
}

#[derive(Debug, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StepKind {
    ManualTrigger { with: serde_json::Value },
    WebScraper    { with: WebScraperArgs },
    LocalFileReader { with: FileReaderArgs },
    AiAgent       { with: AiAgentArgs },
}

#[derive(Debug, serde::Deserialize)]
pub struct AiAgentArgs {
    pub model: String,
    pub goal: String,
    pub context: String,
    #[serde(default = "default_max_iter")]
    pub max_iterations: u32,
    pub allowed_tools: Vec<String>,
}
fn default_max_iter() -> u32 { 10 }
```

`#[serde(tag = "type")]` biến trường `type` trong YAML thành discriminant của enum → parse sai `type` sẽ lỗi ngay tại bước Parser (đúng nguyên tắc DSL-là-hợp-đồng).

### 3.5. DSL Parser + DAG Compiler

**Bước biên dịch đồ thị (DAG Compilation):**

1. **Parser** đọc file → `Flow` + `Vec<Step>` (serde). Lỗi cú pháp YAML / `type` không hợp lệ → dừng với `CompileError::Parse`.
2. Xây đồ thị: mỗi `step.id` là một node; mỗi phần tử trong `needs` là cạnh `dep -> step`.
3. Validate: mọi id trong `needs` phải tồn tại (không thì `CompileError::UnknownDependency`); id step không trùng.
4. **Topological Sort** bằng `petgraph`. Nếu phát hiện chu trình (A cần B, B cần A) → `CompileError::Cycle`, **dừng chương trình** (không chạy bất kỳ bước nào).

```rust
use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::algo::toposort;
use std::collections::HashMap;

pub fn compile(flow: &Flow) -> Result<Vec<String>, CompileError> {
    let mut g = DiGraph::<&str, ()>::new();
    let mut idx: HashMap<&str, NodeIndex> = HashMap::new();

    for s in &flow.steps {
        if idx.contains_key(s.id.as_str()) {
            return Err(CompileError::DuplicateId(s.id.clone()));
        }
        idx.insert(&s.id, g.add_node(&s.id));
    }
    for s in &flow.steps {
        for dep in &s.needs {
            let from = *idx.get(dep.as_str())
                .ok_or_else(|| CompileError::UnknownDependency(dep.clone()))?;
            g.add_edge(from, idx[s.id.as_str()], ()); // dep -> step
        }
    }
    match toposort(&g, None) {
        Ok(order) => Ok(order.into_iter().map(|n| g[n].to_string()).collect()),
        Err(cycle) => Err(CompileError::Cycle(g[cycle.node_id()].to_string())),
    }
}
```

> Tối ưu song song (NFR-4): thay vì chỉ trả thứ tự tuyến tính, executor có thể xử lý theo **tầng (levels)** — mọi step cùng tầng (không phụ thuộc nhau) chạy đồng thời bằng `tokio::join!`/`JoinSet`.

### 3.6. Cơ chế phân rã biến (Variable Resolution)

Trước khi chạy một step, Scheduler quét mọi chuỗi trong `with`. Nếu gặp `{{steps.step_id.field}}`:

1. Truy vấn `SELECT outputs FROM step_executions WHERE step_id = $1 AND run_id = $2`.
2. Trích `field` từ JSON `outputs`.
3. Thay token bằng giá trị thật rồi mới truyền vào hàm thực thi.

```rust
use regex::Regex;
use once_cell::sync::Lazy;

static TOKEN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\{\{\s*steps\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*\}\}").unwrap());

pub async fn resolve(
    raw: &str, run_id: Uuid, store: &impl Store,
) -> Result<String, ResolveError> {
    let mut out = String::new();
    let mut last = 0;
    for cap in TOKEN.captures_iter(raw) {
        let m = cap.get(0).unwrap();
        out.push_str(&raw[last..m.start()]);
        let (step_id, field) = (&cap[1], &cap[2]);
        let outputs = store.get_step_outputs(run_id, step_id).await?
            .ok_or_else(|| ResolveError::MissingStep(step_id.into()))?;
        let val = outputs.get(field)
            .ok_or_else(|| ResolveError::MissingField(step_id.into(), field.into()))?;
        out.push_str(&val_to_string(val));
        last = m.end();
    }
    out.push_str(&raw[last..]);
    Ok(out)
}
```

Kết quả resolve được lưu vào `step_executions.resolved_inputs` (JSONB) để phục vụ debug/observability.

### 3.7. Step Executor & nút nội bộ

Mỗi loại nút cài đặt một trait chung, executor điều phối theo trạng thái:

```rust
#[async_trait::async_trait]
pub trait NodeExec {
    /// Trả về outputs (JSON) hoặc lỗi. Lỗi -> step FAILED.
    async fn run(&self, ctx: &StepCtx) -> Result<serde_json::Value, NodeError>;
}
```

- **`manual_trigger`**: trả thẳng `with` làm outputs (không side-effect).
- **`web_scraper`**: `reqwest::get(url)` → `scraper` trích text → outputs `{ "raw_text": "..." }`.
- **`local_file_reader`**: đọc file trong sandbox → outputs `{ "content": "..." }`.

**Cơ chế cô lập lỗi (NFR-1 / AC-3):**

```
for step_id in topo_order:
    if any(dep.status != COMPLETED for dep in needs): -> mark SKIPPED; continue
    mark RUNNING
    resolved = resolve(with)  # ghi resolved_inputs
    match node.run(resolved):
        Ok(out)  -> lưu outputs; mark COMPLETED
        Err(e)   -> lưu error; mark FAILED
# run.status = FAILED nếu tồn tại bước FAILED, else SUCCESS
```

Mỗi cập nhật trạng thái nằm trong một transaction `sqlx` để đảm bảo toàn vẹn.

### 3.8. Vòng lặp Tác nhân AI (AI Agent Runtime — ReAct)

Khi executor gặp `type: ai_agent`, chuyển quyền cho Agent Runtime:

```
[Bắt đầu Agent Node]
   │
   ▼
BƯỚC 1 — Khởi tạo Prompt
   Đóng gói: goal + context + JSON Schema của các tool trong allowed_tools.
   │
   ▼
BƯỚC 2 — Gọi LLM API (reqwest / async-openai)
   Nhận phản hồi định dạng bắt buộc:
     Thought: <suy nghĩ>
     Action: <tên tool> (Arguments: <JSON>)
   │
   ▼
BƯỚC 3 — Parse phản hồi
   ├─ Nếu "Final Answer": ghi outputs + agent_logs vào DB -> trả quyền Core -> KẾT THÚC NODE
   └─ Nếu yêu cầu gọi Tool:
        - Kiểm tra tool ∈ allowed_tools (nếu không -> Observation lỗi, quay Bước 2)
        - Ánh xạ text -> hàm Rust; thực thi (vd: ghi file xuống đĩa)
        - Nhận kết quả HĐH ("Ghi file thành công") -> nối vào lịch sử (Observation)
        - Nếu iteration >= max_iterations -> FAILED
        - Quay lại BƯỚC 2
```

Khung vòng lặp:

```rust
pub async fn run_agent(args: &AiAgentArgs, store: &impl Store, run_id: Uuid, step_id: &str)
    -> Result<serde_json::Value, AgentError>
{
    let mut history = init_history(&args.goal, &args.context, &tool_schemas(&args.allowed_tools));
    for iter in 0..args.max_iterations {
        let raw = llm::chat(&args.model, &history).await?;      // BƯỚC 2
        store.append_agent_log(run_id, step_id, &raw).await?;   // observability
        match parse_react(&raw)? {                              // BƯỚC 3
            ReAct::Final(answer) => return Ok(json!({ "result": answer })),
            ReAct::Action { tool, arguments } => {
                let obs = if args.allowed_tools.iter().any(|t| t == &tool) {
                    tools::dispatch(&tool, arguments).await
                        .unwrap_or_else(|e| format!("Tool error: {e}"))
                } else {
                    format!("Observation: tool '{tool}' không được phép.")
                };
                store.append_agent_log(run_id, step_id, &obs).await?;
                history.push_observation(obs);                  // nối Observation
            }
        }
    }
    Err(AgentError::MaxIterations(args.max_iterations))          // FR-2.5
}
```

**Ghi chú triển khai LLM:** ưu tiên dùng **native tool/function calling** của API (structured) để parser ổn định hơn so với parse text tự do `Thought/Action`. Bản demo có thể dùng text-format như đặc tả; bản kế tiếp chuyển sang function-calling JSON để giảm lỗi parse.

### 3.9. Đặc tả Công cụ Cục bộ (Local Tool Contract)

Tool được mô tả bằng JSON Schema và nhúng vào System Prompt. Ví dụ `local_file_writer`:

```json
{
  "name": "local_file_writer",
  "description": "Ghi dữ liệu văn bản vào một tệp trên ổ đĩa cục bộ (trong sandbox). Dùng khi cần lưu báo cáo hoặc kết quả phân tích.",
  "parameters": {
    "type": "object",
    "properties": {
      "filename": { "type": "string", "description": "Tên file cần lưu, vd: 'report.md'" },
      "content":  { "type": "string", "description": "Nội dung văn bản cần ghi" }
    },
    "required": ["filename", "content"]
  }
}
```

Registry ánh xạ tên tool → hàm Rust:

```rust
pub async fn dispatch(tool: &str, args: serde_json::Value) -> Result<String, ToolError> {
    match tool {
        "local_file_writer" => tools::file_writer(args).await,
        "string_analyzer"   => tools::string_analyzer(args),
        other => Err(ToolError::Unknown(other.into())),
    }
}
```

- **`local_file_writer(filename, content)`** → ghi file trong sandbox, trả path tương đối + "Ghi file thành công".
- **`string_analyzer(text, keyword?)`** → trả số từ, và số lần xuất hiện `keyword` nếu có.

### 3.10. Sandbox & An toàn đường dẫn (Local Sandbox Directory)

- **Đường dẫn cứng:** `SANDBOX_DIR = "./data/storage_sandbox/"` (đọc từ config).
- **Sanitize:** loại bỏ ký tự điều hướng (`../`, `..\`), từ chối đường dẫn tuyệt đối, canonicalize và kiểm tra prefix nằm trong sandbox.
- **Đầu ra:** ghi thành công → lưu path tương đối vào `step_executions.outputs` để tham chiếu kiểm tra thủ công sau khi flow kết thúc.

```rust
pub fn safe_path(sandbox: &Path, filename: &str) -> Result<PathBuf, SandboxError> {
    // từ chối path tuyệt đối và thành phần điều hướng
    let candidate = Path::new(filename);
    if candidate.is_absolute()
        || candidate.components().any(|c| matches!(c, Component::ParentDir | Component::RootDir)) {
        return Err(SandboxError::Traversal(filename.into()));
    }
    let full = sandbox.join(candidate);
    let base = sandbox.canonicalize()?;
    // với file chưa tồn tại: canonicalize thư mục cha rồi kiểm tra prefix
    let check = full.parent().unwrap_or(&full).canonicalize()?;
    if !check.starts_with(&base) {
        return Err(SandboxError::Traversal(filename.into()));
    }
    Ok(full)
}
```

> AC-5: `filename = "../../etc/passwd"` → `SandboxError::Traversal` → tool trả Observation lỗi, không ghi ra ngoài.

### 3.11. Observability & Logging

- Dùng `tracing` với cấu trúc span lồng nhau: `run{run_id}` → `step{step_id}` → `iter{n}`.
- Mỗi vòng ReAct in ra terminal (subscriber `fmt`) **và** append vào `step_executions.agent_logs` (JSONB) — thỏa NFR-2 & AC-4.
- Định dạng log JSONB gợi ý:

```json
[
  { "iter": 0, "type": "thought", "text": "..." },
  { "iter": 0, "type": "action", "tool": "string_analyzer", "arguments": {"...": "..."} },
  { "iter": 0, "type": "observation", "text": "word_count=812" },
  { "iter": 1, "type": "final", "text": "Đã lưu ket_qua_loi.md" }
]
```

### 3.12. Xử lý lỗi & mô hình trạng thái

- Lib (`fa-core`, `fa-store`) dùng `thiserror` định nghĩa lỗi theo domain (`CompileError`, `ResolveError`, `NodeError`, `AgentError`, `ToolError`, `SandboxError`).
- Binary (`fa-cli`) dùng `anyhow` để gộp và in lỗi thân thiện.
- Quy tắc trạng thái (bất biến):
  - Chu trình / parse lỗi → **không** tạo `flow_run`, dừng ngay (compile-time của flow).
  - Bước lỗi runtime → `FAILED` + ghi `error`; hậu duệ → `SKIPPED`.
  - `flow_run` → `SUCCESS` chỉ khi mọi bước `COMPLETED`; ngược lại `FAILED`.

### 3.13. Cấu hình & Secrets

- `SANDBOX_DIR`, `DATABASE_URL`, `LLM_API_KEY`, `LLM_BASE_URL` nạp từ biến môi trường / `.env` (dùng `dotenvy` khi dev).
- **Không** log giá trị API key; chỉ tham chiếu theo tên biến.
- `DATABASE_URL` quyết định driver: `postgres://...` hoặc `mysql://...` (MariaDB) — cùng API `sqlx`.

> **Lưu ý bảo mật:** nếu về sau expose API server (`axum`) ra mạng, phải bổ sung auth — bản MVP zero-auth chỉ nên bind `127.0.0.1`.

### 3.14. API Backend (axum) — Hợp đồng FE ↔ BE

Backend `fa-api` là ranh giới duy nhất giữa Flutter và Core Engine. Toàn bộ trao đổi là JSON; log realtime đẩy qua WebSocket.

**REST endpoints (MVP):**

| Method | Path | Mô tả | Body / Response |
|---|---|---|---|
| `GET` | `/api/flows` | Liệt kê flow đã lưu | `[{ id, name, created_at }]` |
| `POST` | `/api/flows` | Tạo/nạp flow từ DSL text | req `{ dsl_script }` → validate (parse + compile) → `{ id, name }` hoặc `422` + lỗi biên dịch |
| `GET` | `/api/flows/{id}` | Lấy chi tiết + `dsl_script` | `{ id, name, dsl_script }` |
| `PUT` | `/api/flows/{id}` | Cập nhật DSL (validate lại) | req `{ dsl_script }` |
| `POST` | `/api/flows/{id}/runs` | Kích hoạt chạy (manual trigger) | req `{ initial_inputs }` → `{ run_id, status }` |
| `GET` | `/api/runs/{id}` | Trạng thái run + các step | `{ status, steps: [{ step_id, status, outputs, error }] }` |
| `GET` | `/api/runs/{id}/steps/{step_id}` | Chi tiết 1 step (kèm `agent_logs`) | `{ status, resolved_inputs, outputs, agent_logs }` |

**WebSocket:** `GET /api/runs/{id}/logs` (upgrade) — server đẩy từng sự kiện ReAct ngay khi Agent sinh ra, để FE hiển thị "suy nghĩ" của Agent theo thời gian thực:

```json
{ "run_id": "…", "step_id": "ai_analyst_agent", "iter": 0, "type": "thought", "text": "…" }
{ "run_id": "…", "step_id": "ai_analyst_agent", "iter": 0, "type": "action", "tool": "string_analyzer", "arguments": { } }
{ "run_id": "…", "step_id": "ai_analyst_agent", "iter": 0, "type": "observation", "text": "word_count=812" }
{ "run_id": "…", "type": "run_status", "status": "SUCCESS" }
```

Cơ chế: executor phát event qua `tokio::sync::broadcast`; handler WS subscribe theo `run_id` và forward xuống client. Đây chính là kênh hiện thực hóa NFR-2 (Observability) ở tầng UI.

**Validate ở tầng API:** `POST /api/flows` chạy Parser + DAG Compiler ngay; nếu chu trình/parse lỗi → trả `422` kèm thông điệp lỗi để FE hiện gạch đỏ trong editor (AC-1 được phản ánh lên UI).

**CORS & bind:** dùng `tower-http::CorsLayer` cho phép origin của Flutter Web (dev: `http://localhost:xxxx`). MVP bind `127.0.0.1` (zero-auth, không expose ra mạng).

### 3.15. Frontend Flutter

**Mục tiêu:** một codebase Dart, target **Web trước tiên**, sẵn sàng build Desktop/Mobile về sau mà không đổi kiến trúc.

**Package đề xuất** (pin phiên bản stable mới nhất khi khởi tạo):

| Vai trò | Package | Ghi chú |
|---|---|---|
| State management | `flutter_riverpod` | Đơn giản, testable; thay thế được bằng `bloc` nếu team quen |
| HTTP client | `dio` | Interceptor, base URL theo môi trường |
| WebSocket | `web_socket_channel` | Stream log ReAct realtime → `StreamBuilder` |
| Model + JSON | `freezed` + `json_serializable` | Sinh DTO khớp hợp đồng API mục 3.14 |
| Routing | `go_router` | URL-based, hợp Web (deep link) lẫn Desktop/Mobile |
| Editor DSL (YAML) | `re_editor` / `flutter_code_editor` | Soạn DSL có syntax highlight; validate qua API |
| Env config | `--dart-define` / `envied` | Truyền `API_BASE_URL` lúc build |

**Kiến trúc FE (layered, tách biệt UI ↔ data):**

```
UI (widgets)  →  Controller/Provider (Riverpod)  →  Repository  →  ApiClient (dio/ws)  →  fa-api
```

- **Models** sinh bằng `freezed` từ đúng schema DTO của `fa-api` (mục 3.14) để FE ↔ BE không lệch hợp đồng.
- **Live log view:** màn Run mở WebSocket `/api/runs/{id}/logs`, dựng `StreamBuilder` render timeline Thought → Action → Observation theo `iter`, kèm badge trạng thái step (PENDING/RUNNING/COMPLETED/FAILED/SKIPPED).
- **Editor flow:** ô soạn DSL YAML; nhấn "Validate/Save" gọi `POST/PUT /api/flows`; lỗi `422` hiển thị inline.

**Chiến lược đa nền tảng (Web → Desktop → Mobile):**

- **Web (MVP):** `flutter build web`; app gọi `fa-api` chạy local (`127.0.0.1`). Lưu ý CORS đã cấu hình ở BE.
- **Desktop (tương lai):** `flutter build macos|windows|linux`; đóng gói kèm **binary `fa-api` như sidecar** — app tự khởi động backend cục bộ khi mở, cho trải nghiệm "một app cài đặt duy nhất", đúng tinh thần local-first.
- **Mobile (tương lai):** dùng lại toàn bộ UI/logic; chỉ cần trỏ `API_BASE_URL` tới backend (máy khác trong LAN hoặc bản đóng gói). Truy cập file sandbox trên mobile bị hạn chế bởi OS nên tính năng "xem file output" sẽ hiển thị nội dung qua API thay vì mở file cục bộ.

> **Nguyên tắc giữ vững:** FE không nhúng logic engine. Mọi validate DSL, compile DAG, chạy Agent đều ở backend Rust; Flutter chỉ trình bày và điều khiển qua API. Nhờ vậy đổi/nâng cấp engine không kéo theo sửa FE, và ngược lại.

---

### 3.16. Agent/Tool Protocol (chuẩn hoá theo MCP)

Để "thêm agent mới thuận lợi về sau", FlowAgent định nghĩa một **protocol nội bộ cho Tool/Agent** có hình dạng **tương thích khái niệm với Model Context Protocol (MCP)** — chuẩn mở đang phổ biến cho việc khai báo/gọi tool giữa LLM và ứng dụng (cùng chuẩn mà các nền tảng như "Agent Hub" dùng qua FastMCP).

**Ánh xạ khái niệm (fa-core `protocol.rs`):**

| Khái niệm FlowAgent | Tương ứng MCP | Vai trò |
|---|---|---|
| `trait Tool` | *tool* | Một năng lực đơn: `name`, `description`, `input_schema` (JSON Schema), `call(args, ctx) -> ToolOutput`. |
| `ToolOutput { content: [ToolContent], is_error }` | `CallToolResult` | Kết quả dạng *content blocks* (`text` / `resource`) + cờ `isError`. |
| `trait Agent` | *server* | Một **gói năng lực** (capability pack) gom nhiều Tool cùng lĩnh vực (vd `pdf`, `scraper`, `chart`). |
| `Registry` | *host/registry* | Đăng ký agent/tool; sinh schema cho prompt; điều phối `call`; xuất *catalog*. |

```
ai_agent (ReAct)  ──►  tools::dispatch(name, args, sandbox)
                          │
                          ▼
                    protocol::Registry  ── expand_allowed(["pdf"]) ─► [pdf_extract_text, pdf_metadata, pdf_search]
                          │  tra cứu theo tên
                          ▼
                    dyn Tool::call(args, ToolContext{ sandbox_dir })  ─►  ToolOutput (content + isError)
```

**Tham chiếu theo gói (SaaS-friendly).** Trong DSL, `allowed_tools` của nút `ai_agent` chấp nhận **tên tool cụ thể** *hoặc* **id của cả gói agent**. Registry tự khai triển (`expand_allowed`) id gói thành danh sách tool. Nhờ vậy người dùng không rành kỹ thuật chỉ cần "bật" nguyên gói:

```yaml
allowed_tools: [pdf, chart]   # = pdf_extract_text, pdf_metadata, pdf_search, render_chart
```

**Ba agent đầu tiên (mục tiêu MVP mở rộng):**

| Agent (id) | Định vị | Tool |
|---|---|---|
| 📄 **PDF Agent** (`pdf`) | Document Intelligence | `pdf_extract_text`, `pdf_metadata`, `pdf_search` (dùng `lopdf`, chạy trong `spawn_blocking`) |
| 🌐 **Scraper Agent** (`scraper`) | Web Intelligence Gathering | `scrape_text`, `scrape_links`, `scrape_metadata` (reqwest + `scraper`, loại script/style) |
| 📊 **Chart Agent** (`chart`) | Business Intelligence Visualization | `render_chart` (SVG thuần Rust: `bar`/`line`/`pie`, ghi vào sandbox) |
| 🧰 Core (`core`) | Nền tảng | `local_file_writer`, `string_analyzer` |

Tất cả tool ghi tệp đều đi qua `sandbox::safe_path` (NFR-3). Đầu ra tệp (SVG, MD) được trả kèm `ToolContent::Resource` để FE tham chiếu/hiển thị.

**Catalog (khám phá kiểu SaaS).**
- REST: `GET /api/agents` (toàn bộ) và `GET /api/agents/{id}` — trả danh mục agent + tool kèm `inputSchema` (đúng hình dạng MCP) để FE dựng "chợ agent".
- CLI: `fa agents` in danh mục ra terminal.

**Thêm một agent mới — 3 bước, không đụng engine:**
1. Tạo module trong `crates/fa-core/src/agents/<ten>.rs`: implement `Agent` + các `Tool`.
2. Thêm vào `agents::default_agents()`.
3. Xong — DSL validate, prompt schema, dispatch, catalog API và tham chiếu gói tự động nhận agent mới.

**Hướng mở rộng (đúng tinh thần "chuẩn thế giới").** Vì hình dạng dữ liệu đã trùng MCP, có thể bắc cầu hai chiều mà không đổi engine:
- *Xuất*: bọc `Registry` sau một **MCP server (JSON-RPC)** để mọi MCP client (Claude Desktop, IDE…) dùng lại các tool này.
- *Nhập*: viết một `Agent` proxy gọi tới **MCP server bên thứ ba**, biến mọi tool MCP có sẵn ngoài cộng đồng thành một gói dùng được ngay trong FlowAgent.

---

## 4. Lộ trình triển khai (Roadmap)

| Mốc | Nội dung | Đầu ra kiểm chứng |
|---|---|---|
| M1 — Scaffold | Cargo workspace, `sqlx` + migrations (Postgres), enum trạng thái | `cargo build`, migrate chạy sạch |
| M2 — DSL + DAG | Parser (serde), compiler (petgraph toposort), phát hiện chu trình | AC-1 |
| M3 — Core nodes | `manual_trigger`, `web_scraper`, `local_file_reader`, variable resolver | Chạy flow không-Agent, lưu outputs |
| M4 — Agent runtime | Vòng ReAct, LLM client, tools registry, sandbox | AC-2, AC-4, AC-5 |
| M5 — Fail isolation | SKIPPED/FAILED theo DAG, transaction trạng thái | AC-3 |
| M6 — Observability | `tracing` spans + agent_logs JSONB, CLI in log đẹp | NFR-2 |
| M7 — API backend | `fa-api` (axum): REST CRUD flow/run + broadcast event | Endpoint mục 3.14 chạy được |
| M8 — WebSocket log | `/api/runs/{id}/logs` stream event ReAct realtime | Client nhận log theo thời gian thực |
| M9 — FE Flutter (Web) | List/editor DSL, nút Run, live log view (Riverpod + dio + ws) | Chạy flow end-to-end từ trình duyệt |
| M10 — MariaDB parity | Biến thể migration + test trên MariaDB | NFR-5 |
| M11 — Desktop bundle *(tùy chọn)* | `flutter build` desktop + `fa-api` sidecar | App cài đặt đơn (local-first) |
| M12 — Agent/Tool Protocol + agent packs | `protocol.rs` (MCP-aligned) + agent `pdf`/`scraper`/`chart` + catalog API | `fa agents`, `GET /api/agents`, `allowed_tools: [pdf, chart]` chạy end-to-end |
| M13 — MCP bridge *(tương lai)* | Xuất Registry ra MCP server / nhập MCP server bên thứ ba | Tool MCP dùng chéo được |

## 5. Rủi ro & Hướng mở rộng

- **Parse phản hồi LLM không ổn định (text ReAct).** Giảm thiểu bằng native function-calling (JSON) + retry có kiểm soát.
- **Agent lặp tốn token.** `max_iterations` + log chi phí token mỗi vòng (mở rộng cột `outputs`/bảng usage).
- **Web scraper gặp trang JS-render.** MVP chỉ HTML tĩnh; tương lai tích hợp headless browser (ngoài phạm vi).
- **Đa nền tảng Flutter:** rủi ro khác biệt hành vi giữa Web và Desktop/Mobile (truy cập file, WebSocket, CORS). Giảm thiểu bằng cách giữ mọi logic ở backend và chỉ trỏ `API_BASE_URL` theo target; test sớm trên từng nền tảng.
- **Đóng gói sidecar Desktop:** vòng đời tiến trình `fa-api` (khởi động/tắt cùng app), chọn cổng trống động — cần xử lý ở bản Desktop tương lai.
- **Mở rộng tương lai (ngoài MVP):** thêm nút điều kiện/loop, scheduler cron, thêm tools (HTTP request, DB query), và nâng FE Flutter từ editor DSL dạng văn bản lên **Canvas kéo-thả** đọc/ghi chính DSL này (giữ nguồn sự thật là văn bản).

---

### Phụ lục A — Nguồn tham khảo định vị (đã diễn giải lại)

- So sánh Gumloop với Zapier/n8n: Gumloop là nền tảng **AI-native no-code** dựng workflow/agent trên canvas node, mạnh với dữ liệu phi cấu trúc, tính phí theo credit; Zapier thiên tích hợp SaaS và chạy tuyến tính (per-task); n8n mã nguồn mở, self-host, hỗ trợ logic phức tạp và viết code (per-execution/miễn phí self-host). *(Nội dung được diễn giải lại từ tài liệu tham khảo do người dùng cung cấp để tuân thủ yêu cầu bản quyền.)*
- FlowAgent kế thừa: **kiểm soát DAG** (Zapier/n8n) + **lớp nhận thức Agent** (Gumloop), theo hướng **DSL-first**, chạy local-first với backend Rust và FE Flutter (Web → Desktop/Mobile).

## 6. So Sánh Kiến Trúc Với Cronflow

> Phần này được xây dựng từ các tài liệu nội bộ có sẵn trong workspace: `cronflow/docs/architecture.md`, `cronflow/README.md`, `cronflow/docs/api-reference.md`, `cronflow/core/src/models.rs`, `cronflow/core/src/step_orchestrator.rs`, `cronflow/core/src/workflow_state_machine.rs`.
>
> Lưu ý: ở một vài chỗ, mình diễn giải theo hành vi kiến trúc thể hiện trong source/docs, không phải theo claim marketing.

### 6.1. Design Philosophy

| Trục | Cronflow | FlowAgent |
|---|---|---|
| Người dùng mục tiêu | Developer đã sống trong TypeScript/Node.js, muốn workflow engine "nhúng vào codebase" | Solo dev / AI engineer muốn source of truth là văn bản, có UI mỏng để vận hành |
| Triết lý trung tâm | `code-first` | `DSL-first` |
| Đơn vị biểu đạt chính | Fluent TypeScript API, step/action/hook/trigger | YAML/JSON DSL, node/needs/with, `ai_agent` |
| Mục tiêu tối ưu | DX, IDE, compile-time validation, version control | Determinism của flow, local-first, auto-compile DAG, AI runtime tích hợp |
| GUI | Không phải trung tâm của kiến trúc; API và code là giao diện chính | Không dùng canvas làm nguồn sự thật; Flutter chỉ là lớp trình bày trên DSL |

Cronflow không có GUI vì nó không cố trở thành một nền tảng cho non-developer. Nó tối ưu cho nhóm đã làm việc trong TypeScript, nơi IDE, lint, type-check, diff và PR review là "UI thật". GUI trong bối cảnh đó chỉ làm tăng độ phức tạp mà không tăng nhiều giá trị cốt lõi.

FlowAgent dùng DSL vì mục tiêu khác: giữ cấu hình ở dạng văn bản dễ lưu trữ, diff, sinh tự động, và biên dịch thành DAG trước khi chạy. Đây là lựa chọn tốt khi muốn biến workflow thành artifact độc lập với ngôn ngữ host. Đổi lại, FlowAgent phải tự xây compiler, validator, linter và editor tooling để bù cho việc không được TypeScript bảo vệ.

Kết luận ở mức triết lý: Cronflow chọn "ngôn ngữ của dev", FlowAgent chọn "ngôn ngữ của hệ thống".

### 6.2. Runtime Architecture

Cronflow trong docs/source đang đi theo chuỗi:

`Workflow Definition` -> `Workflow Runtime` -> `Step Execution` -> `Context` -> `Hooks` -> `Completion`

FlowAgent đi theo chuỗi:

`DSL Parser` -> `Compiler` -> `DAG` -> `Executor` -> `Agent Runtime` -> `Tool Runtime` -> `Storage` -> `Frontend`

| Trục | Cronflow | FlowAgent |
|---|---|---|
| Scheduling | Scheduler/trigger listener là một phần của runtime Rust core | Scheduler là executor của DAG; ai-agent là runtime riêng trong một node |
| Execution | Step được dispatch sang JS/Bun task runner qua bridge | Core node chạy trực tiếp trong Rust, ai_agent chuyển sang vòng ReAct |
| Context propagation | `ctx.payload`, `ctx.last`, `ctx.steps`, `ctx.meta`, `ctx.services` | `resolved_inputs` được resolve từ DB, output được lưu và tra lại bằng resolver |
| Retry | Retry gắn với step/job, có backoff, jitter, attempt count | Hiện thiên về `max_iterations` cho agent; retry per-step cần chuẩn hóa thêm |
| Error isolation | Workflow state machine quản lý fail/retry/timeout/pause/cancel | Step lỗi -> `FAILED`, hậu duệ -> `SKIPPED`, transaction theo bước |
| Observability | Structured logging + inspect API + step/run history | Logging sâu hơn cho AI: thought/action/observation + DB + WS realtime |

Điểm khác biệt quan trọng là Cronflow xem step execution như một công việc được orchestration, còn FlowAgent xem một phần workflow như một quá trình suy luận có trạng thái. Cronflow tối ưu cho "chạy được, retry được, kiểm soát được". FlowAgent tối ưu cho "có thể suy luận, có thể gọi tool, có thể quan sát được từng vòng".

### 6.3. Workflow Model

Cronflow mô hình hóa workflow bằng `step`, `action`, `if`, `webhook`, `schedule`, `event`, `parallel`, `human-in-the-loop`. Trong source hiện tại, `StepDefinition` còn chứa retry, timeout, control-flow block, parallel metadata và pause flag. Đây là một mô hình workflow khá giàu ngữ nghĩa nhưng vẫn giữ trọng tâm là code.

FlowAgent mô hình hóa bằng `node`, `needs`, `resolver`, `manual_trigger`, `web_scraper`, `local_file_reader`, `ai_agent`, `local_file_writer`, `string_analyzer`.

| Tiêu chí | Cronflow | FlowAgent |
|---|---|---|
| Abstraction level | Gần với orchestration library cho app developer | Gần với workflow compiler + agent runtime |
| Expressive power | Mạnh ở branching, retry, webhook, schedule, human approval, parallel | Mạnh ở DAG + resolve + agentic loop + tool sandbox |
| Extensibility | Thêm step/trigger/hook trong code TypeScript | Thêm node/tool/agent/MCP server trong Rust/DSL |
| Độ rõ của dataflow | `ctx` flow rất trực tiếp và thân quen | Dataflow tách rõ giữa input đã resolve, output đã lưu, và nguồn DB |

Cronflow "rộng" hơn ở kiểu điều phối chung cho ứng dụng web. FlowAgent "sâu" hơn ở khả năng gắn AI vào đúng một điểm trong runtime thay vì nhét AI vào từng step như một helper.

### 6.4. AI Integration

Đây là điểm khác nhau lớn nhất.

| Câu hỏi | Cronflow | FlowAgent |
|---|---|---|
| AI là gì? | Về mặt kiến trúc hiện tại, AI chỉ là một việc bạn có thể làm trong step/action | AI là một execution engine riêng ở cấp node |
| Planning | Không phải concern lõi của runtime | Lập kế hoạch là core behavior của `ai_agent` |
| Tool calling | Nếu cần thì người dùng tự code trong step JS/TS | Có registry, allowed tools, sandbox, loop và observation |
| Autonomy | Hạn chế, theo kiểu "code chạy đến đâu thì đến đó" | Cao hơn, vì node AI tự lặp cho đến khi ra final answer hoặc chạm ngưỡng |

Theo source/docs mình đã xem, Cronflow không có một AI runtime riêng biệt. AI trong Cronflow, nếu có, nên được coi là một step thường trú trong application code. Điều đó hợp lý khi AI chỉ là một tác vụ phụ trợ. Nhưng khi workflow phải suy luận, chọn tool, lặp kế hoạch, tự sửa sai, thì AI không còn nên nằm trong một step đơn lẻ nữa.

Khi nào AI chỉ nên là một node:

- Bài toán chủ yếu là deterministic, AI chỉ làm enrichment hoặc classification.
- Logic cần audit và review như code bình thường.
- Sai sót của AI không được phép điều khiển cả vòng đời execution.

Khi nào AI nên là execution engine:

- Bài toán cần planning nhiều bước, tool selection, memory và recovery.
- Input không hoàn chỉnh, đầu ra không biết trước.
- Workflow cần "tự xoay" dựa trên quan sát mới, giống một operator hơn là một function.

Trade-off là rõ ràng: càng trao autonomy cho AI, càng phải chấp nhận tính bất định, nhu cầu sandbox mạnh hơn, logging sâu hơn, và policy kiểm soát tool chặt hơn.

### 6.5. DSL Vs Code

| Tiêu chí | Cronflow (`TypeScript`) | FlowAgent (`YAML DSL` + Rust + Flutter) |
|---|---|---|
| Maintainability | Rất tốt nếu team đã chuẩn hóa TypeScript/Node | Tốt nếu compiler/validator đủ mạnh |
| Readability | Đọc như code, quen với dev | Đọc như cấu hình, quen với ops/automation |
| Version control | Diff rõ, review trong PR rất tự nhiên | Diff cũng rõ, nhưng cần schema/lint để giảm lỗi cú pháp |
| Compile-time validation | Mạnh nhờ TypeScript | Phải tự xây parser, type model, linter, maybe language server |
| Static analysis | Thừa hưởng hệ sinh thái TS | Phải xây từ đầu hoặc dùng JSON Schema / Rust types |
| IDE support | Rất mạnh | Chỉ mạnh nếu có tooling riêng |
| AI-generated workflow | Sinh code TS được, nhưng dễ tạo boilerplate nặng | Sinh YAML DSL thường dễ hơn, ít nhiễu hơn |
| Visual editor | Không phải trung tâm | Có thể xây sau, nhưng không nên là source of truth |

Đánh giá thẳng: `DSL-first` không tự động tốt hơn `code-first`. Nó chỉ tốt hơn khi workflow cần được sinh tự động, kiểm soát bằng machine validation, và tách khỏi host language. Nếu không đầu tư toolchain, DSL sẽ thành gánh nặng.

Ngược lại, `code-first` thắng rõ ở compile-time validation và IDE support. Cronflow tận dụng trực tiếp TypeScript để biến workflow thành một phần của codebase thay vì một format riêng cần bảo trì.

### 6.6. Extensibility

| Hạng mục | Cronflow | FlowAgent |
|---|---|---|
| Thêm step mới | Viết step/action trong TS, tận dụng runtime sẵn có | Thêm node mới trong Rust core, cập nhật DSL schema và executor |
| Thêm trigger | Tự nhiên với webhook/event/schedule/poller | Có thể thêm trigger node, nhưng phải đi qua compiler và run model |
| Thêm hook | Hook là khái niệm core của Cronflow | FlowAgent hiện thiên về event/log; hook là phần nên cân nhắc bổ sung |
| Plugin ecosystem | Dễ ăn vào hệ sinh thái JS/TS | Dễ ăn vào hệ sinh thái AI/tool/MCP |
| Enterprise deployment | Dễ nhúng vào app hiện có, dễ chuẩn hóa CI/CD | Dễ kiểm soát sandbox và audit, nhưng cần thêm auth/multi-tenant nếu lên enterprise |
| AI ecosystem | Không phải chiến trường chính | Có lợi thế tự nhiên nhờ `tool`, `agent`, `allowed_tools`, MCP-aligned protocol |

Nếu mục tiêu là plugin ecosystem rộng và "đi vào đâu cũng cắm được", Cronflow có lợi thế vì đứng trên TypeScript. Nếu mục tiêu là AI ecosystem, FlowAgent có cấu trúc đúng hơn để trở thành host của tool/agent.

### 6.7. Data Flow

Cronflow:

`ctx -> ctx.last -> return -> next step`

FlowAgent:

`resolved_inputs -> outputs -> database -> resolver -> next node`

| Trục | Cronflow | FlowAgent |
|---|---|---|
| Stateless / stateful | Step logic khá stateless, state chủ yếu đi qua `ctx` | Stateful rõ hơn, vì outputs và resolved inputs được lưu DB |
| Replay | Có thể replay ở mức run history, nhưng phụ thuộc cách bạn lưu `ctx` và logs | Có nền tảng replay/audit tốt hơn vì dataflow được vật hóa trong DB |
| Audit | Tốt cho ứng dụng code-first | Tốt hơn cho phân tích workflow và AI debugging |
| Debugging | Dễ gỡ lỗi kiểu app developer | Dễ gỡ lỗi kiểu engine developer, nhưng log có thể dày |

FlowAgent đang chọn một mô hình "vật hóa" dataflow. Đây là lợi thế lớn cho audit, UI realtime, và resolver. Nhưng nó cũng tạo ra áp lực đồng bộ schema, versioning của outputs, và chi phí storage.

Cronflow nhẹ hơn vì context di chuyển qua runtime. Điều đó đơn giản và hiệu quả, nhưng độ truy nguyên của một run phức tạp thường thấp hơn nếu không thiết kế log/history thật cẩn thận.

### 6.8. Execution Engine

| Framework | Gần với gì | Vì sao |
|---|---|---|
| Cronflow | Temporal, Prefect, Airflow, nhưng embedded hơn | Có stateful orchestration, retry, timeout, scheduler, hooks, trigger listeners, nhưng business logic chạy trong JS/TS host |
| FlowAgent | LangGraph, AutoGen, CrewAI Runtime, Semantic Kernel Planner | Có node graph, agent loop, tool calling, planning, memory qua context/DB |

Cronflow không phải Temporal đầy đủ vì nó không nhắm đến mô hình distributed durable workflow ở quy mô platform ngay từ đầu. Nó giống một workflow runtime nhúng cho developer app hơn là một orchestration service độc lập.

FlowAgent cũng không phải chỉ là LangGraph, vì nó không chỉ là graph của LLM states. Nó có compiler DAG, resolver, storage, sandbox và FE. Nói cách khác, FlowAgent là một workflow engine có lõi agentic, còn LangGraph/CrewAI/AutoGen thường là agent framework có graph/state.

Nếu phải chốt một câu:

- Cronflow là `workflow orchestration with developer code as the execution surface`.
- FlowAgent là `workflow orchestration with AI agent as a first-class runtime`.

### 6.9. Developer Experience

| Persona | Cronflow | FlowAgent |
|---|---|---|
| Startup | Rất hợp nếu đội đã dùng Node/TS và muốn ship nhanh | Rất hợp nếu sản phẩm của startup là AI automation và cần local-first |
| Enterprise | Hợp khi cần chuẩn hóa code review, CI/CD, SDK integration | Hợp khi cần sandbox, audit, local-first, nhưng còn thiếu auth/multi-tenant |
| Solo developer | Rất dễ bắt đầu nếu quen code | Rất hợp vì DSL ngắn gọn và engine local-first |
| Logging/monitoring | Tốt cho dev app truyền thống | Tốt hơn cho AI reasoning và tool invocation |
| Test | Mạnh nhờ test harness code-first | Cần thêm compiler tests, resolver tests, agent loop tests, sandbox tests |

Cronflow thắng ở "đường cong học nhanh" cho dev TS. FlowAgent thắng ở "tính mô hình hóa" cho AI automation, nhưng yêu cầu kỷ luật kỹ thuật cao hơn ở compiler, runtime và observability.

### 6.10. Architecture Evolution

Nếu nhìn 5 năm tới, Cronflow có thể tiến hóa theo hướng:

- Trở thành orchestration SDK mạnh hơn cho app backend, gần với Temporal-lite nhưng code-first hơn.
- Tăng chất lượng hooks, retry, durable state, test harness, and developer tooling.
- Có thể thêm AI helpers, nhưng AI vẫn nên là một capability chứ không phải trung tâm runtime.

FlowAgent nên tiến hóa theo hướng:

- Thêm compiler/linter/LSP cho DSL.
- Thêm visual builder nhưng giữ DSL là nguồn sự thật.
- Thêm optimization pass cho DAG, memoization, caching và resource planning.
- Thêm distributed execution chỉ sau khi single-node correctness, sandbox và observability đã vững.

Nên thêm gì:

- Visual builder: có, nhưng là projection của DSL.
- AI workflow generation: có, vì DSL là đích sinh tự nhiên.
- Compiler: bắt buộc.
- Static analyzer: bắt buộc nếu muốn dùng lâu dài.
- Optimization pass: nên có sau compiler.
- Distributed execution: chỉ nên thêm khi cần scale thật sự, không phải vì trông "enterprise".

### 6.11. Design Critique

Đây là phần thẳng nhất.

#### Những điểm FlowAgent làm đúng

- Chọn `DSL-first` để giữ source of truth nhỏ, diff rõ, sinh tự động được.
- Tách `ai_agent` thành runtime riêng thay vì giả vờ nó chỉ là một step bình thường.
- Có sandbox rõ ràng cho tool ghi file.
- Có compiler/DAG/resolver để workflow deterministic trước khi đụng tới AI.
- Có đường API và UI rõ ràng, không để FE can thiệp vào engine logic.

#### Những điểm có nguy cơ over-engineering

| Thành phần | Rủi ro |
|---|---|
| Flutter Web + Desktop + Mobile ngay từ đầu | Tăng bề mặt sản phẩm quá sớm, trong khi engine core chưa chứng minh xong |
| PostgreSQL + MariaDB parity sớm | Làm nặng migrations, test matrix và API storage layer |
| MCP-aligned protocol quá sớm | Có ích về lâu dài, nhưng dễ làm loãng MVP nếu chưa có tool/agent core ổn định |
| ReAct text parser thuần | Dễ brittle; nên chuyển sang structured tool calling sớm hơn |
| Agent packs quá nhiều | Dễ tạo một lớp abstraction đẹp nhưng chưa thật sự được dùng |

#### Những điểm có nguy cơ under-engineering

- Auth/tenant/permission chưa có.
- Versioning của DSL và resolver chưa được nhấn đủ mạnh.
- Snapshot/replay deterministic cho agent run chưa được mô tả đủ.
- Redaction cho log thought/action/observation chưa thấy là một policy rõ ràng.
- Chiến lược cache, idempotency và concurrency cấp workflow chưa đủ chi tiết nếu lên production.

#### Kiến trúc thay thế hợp lý hơn

1. Giai đoạn 1: `Rust core + CLI + local web UI mỏng`.
2. Giai đoạn 2: thêm Flutter khi API đã ổn và bạn muốn multi-platform.
3. Giai đoạn 3: thêm visual builder như một editor của DSL, không phải nguồn sự thật.
4. Giai đoạn 4: thêm distributed workers và MCP bridge khi plugin ecosystem thực sự cần.

Nếu buộc phải chọn một hướng tối giản hơn cho MVP, mình sẽ bỏ bớt `MariaDB parity`, trì hoãn `Desktop/Mobile`, và giữ tập trung vào `DSL compiler + agent runtime + observability + sandbox`.

### 6.12. Kết Luận

| Tiêu chí | Cronflow | FlowAgent |
|---|---|---|
| Điểm mạnh | DX, code review, TypeScript, retry/timeout/hooks, integration với app code | DSL source of truth, local-first, AI runtime riêng, sandbox, agent/tool protocol |
| Điểm yếu | AI không phải native runtime, phụ thuộc vào app code và host language | Dễ over-engineer, cần compiler/tooling mạnh để bù cho không có type system của TS |
| Trade-off | Ít tự do hơn cho AI, nhưng rất rõ ràng và dễ vận hành | Tự do hơn cho AI, nhưng phức tạp hơn và cần kiểm soát tốt hơn |
| Khả năng thương mại | Mạnh ở SDK/B2B integration, dễ bán cho dev teams | Mạnh ở local-first AI automation platform, nhưng phải chứng minh độ ổn định |
| Khả năng open-source | Rất hợp với cộng đồng dev | Rất hợp nếu engine và DSL được chuẩn hóa tốt |
| Khả năng xây ecosystem | Mạnh ở ecosystem JS/TS | Mạnh ở ecosystem agent/tool/MCP |
| Khả năng thành AI Automation Platform | Trung bình nếu chỉ là workflow engine | Cao hơn nếu giữ được kỷ luật kiến trúc và tránh over-engineering |

**Nếu mục tiêu là xây dựng nền tảng AI Automation thế hệ mới trong 5-10 năm tới, thì nên giữ lại:**

- Từ Cronflow: `code-first` discipline, retry/timeout/hook semantics, context model rõ ràng, test harness, runtime orchestration có state machine, observability theo vòng đời run.
- Từ FlowAgent: `DSL-first`, compiler/DAG/resolver, local-first sandbox, AI runtime là first-class citizen, tool registry, agent packs và định hướng MCP.

**Nên loại bỏ hoặc trì hoãn:**

- Canvas-first làm source of truth.
- Distributed execution trước khi core single-node chín.
- Nhiều backend storage ngay từ đầu.
- Text ReAct parser nếu đã có structured tool calling.
- Những abstraction đẹp nhưng chưa có đường sử dụng rõ ràng trong MVP.

Tóm lại, kiến trúc tốt nhất không phải là "chọn Cronflow hoặc chọn FlowAgent". Kiến trúc tốt nhất là:

- Lấy từ Cronflow kỷ luật của một engine code-first, stateful, có retry và hooks.
- Lấy từ FlowAgent khả năng biến AI thành một runtime thật sự, có DAG, sandbox và tool protocol.
- Loại bỏ mọi thứ làm tăng bề mặt hệ thống nhưng không tăng khả năng tạo giá trị ngay.
