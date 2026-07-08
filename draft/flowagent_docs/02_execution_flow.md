# Execution Flow

Đây là flow runtime quan trọng nhất của FlowAgent.

```text
Load DSL
  ↓
Parse
  ↓
Validate
  ↓
Compile DAG
  ↓
Topological Sort
  ↓
Build Ready Levels / Queue
  ↓
Create Run + Step Records (PENDING)
  ↓
Execute Step
  ↓
Resolve Variables
  ↓
Dispatch Built-in Node or Agent Runtime
  ↓
Store Outputs / Agent Logs
  ↓
Next Step
```

## Diễn giải runtime

1. `Load DSL`
   - DSL được đọc từ file hoặc từ `POST /api/flows`.

2. `Parse`
   - `fa-core::dsl::parse(...)` chuyển YAML/JSON thành `Flow`.

3. `Validate`
   - Kiểm tra `type`, tham số `with`, và `allowed_tools`.
   - Lỗi ở đây trả về `422` ngay, không tạo run.

4. `Compile DAG`
   - `fa-core::compiler::compile(...)` kiểm tra trùng id, dependency lạ, chu trình.

5. `Topological Sort`
   - Flow được sắp theo thứ tự phụ thuộc an toàn.
   - Đồng thời tạo `levels` để biết nhóm nào có thể chạy song song.

6. `Build Ready Levels / Queue`
   - Bước nào có dependency đã `COMPLETED` thì được đưa vào ready set.
   - Step nào phụ thuộc step lỗi thì bị `SKIPPED`.

7. `Execute Step`
   - `manual_trigger`, `web_scraper`, `local_file_reader` đi qua `NodeExec`.
   - `ai_agent` đi sang `Agent Runtime`.

8. `Resolve Variables`
   - Token `{{steps.step_id.field}}` được thay bằng output thật từ DB.
   - Resolver đọc `step_executions.outputs`.

9. `Store Outputs`
   - `resolved_inputs`, `outputs`, `agent_logs`, `error`, `status` đều được lưu.

10. `Next Step`
    - Nếu còn node đủ điều kiện thì lặp tiếp.
    - Nếu có lỗi, descendants của node lỗi không được chạy.

## Điểm kỹ thuật đáng chú ý

- Runtime không đi theo kiểu "một luồng logic chảy trong RAM" mà cố ý vật hóa trạng thái qua DB.
- Điều này giúp audit và replay dễ hơn.
- Đổi lại, engine phải chấp nhận chi phí I/O và schema versioning.

## Failure path

- Parse/validate/cycle error: dừng trước khi tạo run.
- Step runtime error: step `FAILED`.
- Hậu duệ của step lỗi: `SKIPPED`.
- Run cuối cùng: `SUCCESS` chỉ khi mọi step `COMPLETED`.

