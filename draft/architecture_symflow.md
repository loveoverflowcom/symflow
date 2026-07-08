# Symflow Architecture Notes

Tài liệu này mô tả kiến trúc hiện tại của Symflow theo code đang có trong repo, tập trung vào luồng xử lý, các thành phần, interface, API hiện có, và chi tiết hai package lõi:

- `packages/symflow-core`
- `packages/symflow-store`

Mục tiêu là dùng như bản đồ hệ thống để review, mở rộng và đối chiếu với `continue.md` / `draft/flowagent_docs`.

---

## 1. Tóm Tắt Kiến Trúc

Symflow hiện được chia thành 3 lớp chính:

1. `symflow-core`
   - Chứa domain model, DSL, compiler, resolver, executor, agent runtime, event bus, state machine, sandbox, và trait lưu trữ.
   - Đây là lớp thuần logic, không phụ thuộc trực tiếp vào HTTP server hay PostgreSQL.

2. `symflow-store`
   - Chứa implementation lưu trữ PostgreSQL cho trait `Store`.
   - Có repositories + models + `PgStore`.

3. `symflow-api`
   - HTTP entrypoint.
   - Nhận request từ web/CLI, gọi `symflow-core`, và chọn backend lưu trữ qua `Store`.

Luồng tư duy chính:

`API / CLI / Web` -> `symflow-core` -> `Store trait` -> `symflow-store (PgStore)` hoặc `symflow-core::mem::MemoryStore`

---

## 2. Luồng Xử Lý Tổng Quát

### 2.1. Luồng tạo flow

1. Client gọi API tạo hoặc cập nhật flow.
2. `symflow-api` parse payload thành `FlowUpsertRequest`.
3. `symflow-api` dùng `compat::parse_flow_script` để chuẩn hóa DSL.
4. `symflow-core::dsl::Flow` được validate.
5. `symflow-core::compiler::compile` kiểm tra tính hợp lệ của DAG.
6. Nếu hợp lệ, `Store::upsert_flow` được gọi.
7. `symflow-store::PgStore` ghi vào bảng `flows`.
8. API đọc lại flow vừa lưu và trả response.

### 2.2. Luồng trigger run

1. Client gọi `POST /api/flows/:id/runs`.
2. `symflow-api` đọc flow từ store.
3. DSL được parse lại thành `Flow`.
4. API tạo `run_id` qua `Store::create_run`.
5. Một task nền được spawn để chạy flow.
6. `symflow-core::executor::run_flow` dựng trạng thái, resolve biến, chạy node, gọi agent nếu cần.
7. Trong suốt tiến trình, executor vừa:
   - ghi trạng thái vào store
   - phát event realtime qua `RunEvent`
8. Khi xong, run được đánh dấu `SUCCESS` hoặc `FAILED`.

### 2.3. Luồng realtime log

1. Client mở websocket `GET /api/runs/:id/logs`.
2. `symflow-api::realtime` replay lại `agent_logs` đã lưu trong DB.
3. Sau đó websocket subscribe vào broadcast bus của run.
4. Mỗi `RunEvent` mới được forward xuống frontend.

### 2.4. Luồng đọc history

1. Client gọi `GET /api/runs`, `GET /api/runs/:id`, hoặc `GET /api/runs/:id/steps/:step_id`.
2. `symflow-api` đọc dữ liệu từ `Store`.
3. `symflow-store` map row PostgreSQL sang `RunRecord`, `StepRecord`, `FlowRecord`.
4. API trả JSON cho web.

---

## 3. Sơ Đồ Thành Phần

### 3.1. Phân lớp logic

```text
services/symflow-web     services/symflow-cli     services/symflow-api
           |                        |                       |
           +------------------------+-----------------------+
                                    |
                                    v
                            packages/symflow-core
         +-------------------+----------+----------+-------------------+
         |                   |          |          |                   |
       DSL/Compiler        Executor   Agent      Events/Store      MemoryStore
         |                   |          |          |                   |
         +-------------------+----------+----------+-------------------+
                                    |
                                    v
                          packages/symflow-store
                                    |
                                    v
                                 PostgreSQL
```

### 3.2. Thành phần runtime chính

- `dsl`
  - parse và validate flow definition
- `compiler`
  - kiểm tra DAG, suy luận thứ tự chạy
- `resolver`
  - thay token `{{steps.x.y}}` bằng dữ liệu thật
- `executor`
  - điều phối toàn bộ run
- `agent`
  - chạy vòng lặp ReAct cho AI agent
- `events`
  - phát `RunEvent` qua broadcast channel
- `store`
  - định nghĩa interface lưu trữ
- `mem`
  - implementation lưu trữ trong memory cho dev/test
- `symflow-store`
  - implementation PostgreSQL

---

## 4. Interface Cốt Lõi

### 4.1. `Store` trait

`symflow-core::store::Store` là interface quan trọng nhất của hệ thống.

Nó là ranh giới giữa business logic và lưu trữ vật lý.

Các nhóm method:

#### Flows

- `upsert_flow(id, name, dsl_script)`
- `get_flow(id)`
- `list_flows()`
- `delete_flow(id)`

#### Runs

- `create_run(flow_id, initial_inputs)`
- `set_run_status(run_id, status)`
- `get_run(run_id)`
- `list_runs()`

#### Steps

- `upsert_step(run_id, step_id, status)`
- `set_step_status(run_id, step_id, status)`
- `set_step_resolved_inputs(run_id, step_id, inputs)`
- `complete_step(run_id, step_id, outputs)`
- `fail_step(run_id, step_id, error)`
- `get_step_outputs(run_id, step_id)`
- `append_agent_log(run_id, step_id, entry)`
- `list_steps(run_id)`
- `get_step(run_id, step_id)`

Ý nghĩa kiến trúc:

- `symflow-core` chỉ biết gọi trait này.
- `symflow-store` và `mem` là 2 implementation hiện có.
- `symflow-api` giữ store dưới dạng `Arc<dyn Store>`.

### 4.2. `RunEvent`

`symflow-core::events::RunEvent` là event realtime dùng cho websocket.

Các loại event hiện có:

- `thought`
- `action`
- `observation`
- `finalAnswer`
- `stepStatus`
- `runStatus`

Trường chính:

- `runId`
- `stepId`
- `iter`
- `text`
- `tool`
- `arguments`
- `status`

Ngoài ra:

- `RunEvent::log_entry()` tạo bản ghi rút gọn lưu vào `step_executions.agent_logs`
- `RunEvent::from_log_entry()` dùng để replay lại log từ DB

### 4.3. `RunStatus` và `StepStatus`

State machine hiện tại:

- `RunStatus`: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`
- `StepStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`

Hai enum này vừa:

- serialize được cho API
- map được sang chuỗi DB qua `as_db_str()` / `from_db_str()`

### 4.4. DSL model

`symflow-core::dsl::Flow`

- `flow_id`
- `name`
- `steps`

`Step`

- `id`
- `needs`
- `kind`
- `with`

`StepType`

- `manual_trigger`
- `web_scraper`
- `local_file_reader`
- `ai_agent`

Typed args:

- `WebScraperArgs`
- `FileReaderArgs`
- `AiAgentArgs`

---

## 5. API Hiện Có

### 5.1. HTTP API

Các endpoint hiện có trong `symflow-api`:

- `GET /health`
- `GET /api/flows`
- `POST /api/flows`
- `GET /api/flows/:id`
- `PUT /api/flows/:id`
- `DELETE /api/flows/:id`
- `POST /api/flows/:id/runs`
- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/runs/:id/steps/:step_id`
- `GET /api/runs/:id/logs`
- `GET /api/agents`
- `GET /api/agents/:id`

### 5.2. Ý nghĩa từng API

- `GET /api/flows`
  - trả danh sách flow summary
- `POST /api/flows`
  - tạo flow mới
- `GET /api/flows/:id`
  - lấy chi tiết flow
- `PUT /api/flows/:id`
  - cập nhật flow
- `DELETE /api/flows/:id`
  - xóa flow và dữ liệu run liên quan
- `POST /api/flows/:id/runs`
  - trigger run mới
- `GET /api/runs`
  - list history run
- `GET /api/runs/:id`
  - trả run detail + steps
- `GET /api/runs/:id/steps/:step_id`
  - trả chi tiết một step execution
- `GET /api/runs/:id/logs`
  - websocket realtime log

### 5.3. WebSocket payload

Frontend đang nhận `AgentLogEvent` với:

- `runId`
- `stepId`
- `type`
- `iter`
- `text`
- `tool`
- `arguments`
- `status`

Backend replay log từ DB và forward event runtime đều dùng format này.

---

## 6. Package `symflow-core`

### 6.1. Vai trò

`packages/symflow-core` là trái tim của hệ thống.

Nó chứa:

- định nghĩa DSL
- validate và compile flow
- execute run
- run agent
- resolve biến giữa các step
- phát realtime event
- trạng thái run/step
- contract lưu trữ qua trait `Store`

### 6.2. Cấu trúc module

#### `dsl`

Chứa model và parser cho flow.

Đây là nơi xác định:

- input format của DSL
- danh sách step type hợp lệ
- schema của tham số cho từng node

Quan trọng:

- `Flow::validate()` là lớp kiểm tra domain
- `parse()` chọn YAML hoặc JSON

#### `compiler`

Chịu trách nhiệm biến flow thành cấu trúc có thể chạy.

Mục tiêu:

- kiểm tra dependency graph
- phát hiện thứ tự chạy
- đảm bảo không có lỗi DAG cơ bản

#### `resolver`

Chịu trách nhiệm thay token trong value:

- `{{steps.step_id.field}}`

Nó đọc output của step trước từ `Store::get_step_outputs()`.

Vai trò:

- cho phép step sau dùng dữ liệu step trước
- tách resolve logic khỏi executor

#### `executor`

Là scheduler chính.

Nó làm các việc:

1. compile flow
2. tạo step records
3. set run status
4. resolve inputs
5. chạy node hoặc agent
6. lưu step result
7. phát event realtime
8. chốt run status cuối

Đây là phần điều phối trung tâm, không biết đến HTTP.

#### `agent`

Chứa runtime cho vòng lặp AI agent.

Nhìn tổng quát:

- chuẩn bị prompt
- gọi LLM
- parse hành động
- chạy tool
- lưu log thought/action/observation/final

#### `events`

Trung tâm của realtime log.

Nó quyết định:

- event type nào được emit
- log entry nào được persist
- cách replay từ DB

#### `mem`

Implementation `Store` trong memory.

Dùng cho:

- CLI
- test
- dev local khi không có DB

#### `store`

Chứa trait `Store` và data model domain:

- `FlowRecord`
- `FlowSummary`
- `RunRecord`
- `StepRecord`

Đây là package boundary quan trọng nhất giữa core và store backend.

#### `nodes`

Các node runtime không cần AI:

- `manual_trigger`
- `web_scraper`
- `local_file_reader`

#### `protocol`

Protocol cho agent/tool registry.

Mục tiêu:

- chuẩn hóa cách agent gọi tool
- gom API của tools thành interface rõ ràng

#### `agents`

Các agent tích hợp sẵn:

- `core`
- `pdf`
- `scraper`
- `chart`

#### `tools`

Facade cho registry tool/capability.

### 6.3. Data model trong core

`FlowRecord`

- `id`
- `name`
- `dsl_script`
- `created_at`

`RunRecord`

- `id`
- `flow_id`
- `status`
- `initial_inputs`
- `created_at`
- `finished_at`

`StepRecord`

- `run_id`
- `step_id`
- `status`
- `resolved_inputs`
- `outputs`
- `agent_logs`
- `error`
- `executed_at`

### 6.4. Runtime contract

Core luôn đọc và ghi trạng thái qua `Store`.

Ví dụ:

- khi run bắt đầu, `executor` gọi `set_run_status(RUNNING)`
- khi step bắt đầu, gọi `set_step_status(RUNNING)`
- khi có log agent, gọi `append_agent_log(...)`
- khi step xong, gọi `complete_step(...)`
- khi lỗi, gọi `fail_step(...)`

Điểm lợi:

- executor không phụ thuộc DB cụ thể
- có thể thay implementation store mà không sửa core logic

---

## 7. Package `symflow-store`

### 7.1. Vai trò

`packages/symflow-store` là lớp persistence PostgreSQL.

Nó:

- implement trait `Store`
- map row SQL sang domain record
- giữ SQL query theo repository
- hỗ trợ migrations

### 7.2. Cấu trúc module

#### `pg_store`

`PgStore` bọc `PgPool` và implement toàn bộ trait `Store`.

Nó chỉ là lớp delegate:

- `upsert_flow` -> `repositories::flows`
- `create_run` -> `repositories::flow_runs`
- `upsert_step` và các API step -> `repositories::step_executions`

#### `models`

Chứa row types cho `sqlx::FromRow`:

- `FlowRow`
- `FlowSummaryRow`
- `FlowRunRow`
- `StepExecRow`

Mỗi row type có hàm `into_record()` / `into_summary()`.

#### `repositories`

Tách query theo bảng:

- `flows.rs`
- `flow_runs.rs`
- `step_executions.rs`

Mục tiêu:

- dễ bảo trì
- query rõ ràng theo domain
- không nhồi SQL vào `PgStore`

### 7.3. Repository theo bảng

#### `flows`

Hỗ trợ:

- upsert flow
- get flow
- list flows
- delete flow

Khi xóa flow:

- xóa step executions của các run thuộc flow
- xóa flow_runs
- xóa flow

#### `flow_runs`

Hỗ trợ:

- create run
- set run status
- get run
- list runs

#### `step_executions`

Hỗ trợ:

- upsert step
- set step status
- set resolved inputs
- complete step
- fail step
- get step outputs
- append agent log
- list steps
- get step

### 7.4. Schema logic hiện tại

Theo migrations trong package:

#### `flows`

- `id`
- `name`
- `dsl_script`
- `created_at`

#### `flow_runs`

- `id`
- `flow_id`
- `status`
- `initial_inputs`
- `created_at`
- `finished_at`

#### `step_executions`

- `run_id`
- `step_id`
- `status`
- `resolved_inputs`
- `outputs`
- `agent_logs`
- `error`
- `executed_at`

Ràng buộc quan trọng:

- `flow_runs.flow_id` references `flows.id`
- `step_executions.run_id` references `flow_runs.id`
- unique `(run_id, step_id)`

### 7.5. Dòng đọc/ghi dữ liệu

`PgStore` là implementation chính thức cho backend thật.

Flow ghi thường đi theo nhánh:

`API` -> `Store trait` -> `PgStore` -> `repositories/*` -> `PostgreSQL`

Run replay đi theo nhánh:

`API websocket` -> `Store::list_steps()` -> `StepRecord.agent_logs` -> `RunEvent::from_log_entry()`

---

## 8. Dòng Dữ Liệu Quan Trọng

### 8.1. Flow definition

```text
DSL text
  -> parse
  -> Flow
  -> validate
  -> compile
  -> persist as flows.dsl_script
```

### 8.2. Run execution

```text
Trigger run
  -> create_run
  -> executor::run_flow
  -> upsert_step
  -> set_run_status(RUNNING)
  -> resolve inputs
  -> run node / agent
  -> complete_step / fail_step
  -> set_run_status(SUCCESS|FAILED)
```

### 8.3. Realtime log

```text
Agent runtime
  -> emit RunEvent
  -> append_agent_log(log_entry)
  -> broadcast event bus
  -> websocket client receives JSON
```

### 8.4. Replay log

```text
Client connects late
  -> list_steps(run_id)
  -> read agent_logs
  -> from_log_entry()
  -> send historical events first
  -> subscribe live events
```

---

## 9. Nhận Xét Kiến Trúc

### Điểm tốt

- `symflow-core` không phụ thuộc trực tiếp vào DB hay HTTP.
- `Store` trait tạo được ranh giới sạch giữa domain và persistence.
- `PgStore` và `MemoryStore` có thể thay thế lẫn nhau.
- Realtime log đã có cả live forward và replay.

### Điểm cần tiếp tục hoàn thiện

- Persistence cho history run vẫn còn là mảng có thể mở rộng thêm.
- API client web vẫn còn contract cần giữ chặt hơn bằng test tích hợp.
- Cần tiếp tục chuẩn hóa tài liệu API và schema khi thêm package mới.

---

## 10. Ghi Chú Dành Cho Tài Liệu Sau

Nếu muốn mở rộng tài liệu này, các phần tiếp theo nên thêm:

- sequence diagram cho trigger run và websocket replay
- ER diagram cho schema PostgreSQL
- state machine chi tiết cho step status / run status
- lifecycle của AI agent trong `symflow-core::agent`
- mapping rõ hơn giữa DSL step type và node/agent runtime

