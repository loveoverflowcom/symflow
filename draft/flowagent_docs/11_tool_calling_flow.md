# Tool Calling Flow

File này chỉ tập trung vào đường đi của tool call.

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Agent Runtime
    participant Registry as Tool Registry
    participant Tool as Tool
    participant FS as Sandbox / Filesystem
    participant Store as Store

    Agent->>Registry: expand_allowed(allowed_tools)
    Agent->>Registry: prompt_schemas(allowed_tools)
    Agent->>Registry: dispatch(name, args)

    alt name not allowed
        Registry-->>Agent: Observation: tool not allowed
    else allowed
        Registry->>Tool: call(args, ToolContext)
        Tool->>FS: read/write sandbox
        FS-->>Tool: file/content
        Tool-->>Registry: ToolOutput{content, is_error}
        Registry-->>Agent: observation text
        Agent->>Store: append_agent_log(observation)
    end
```

## Luồng quyền hạn

- `allowed_tools` là whitelist ở cấp step.
- `Registry` có thể khai triển `agent id` thành nhiều tool cụ thể.
- Nếu tool name không nằm trong whitelist sau khi khai triển, hệ thống không crash.
- Thay vào đó nó trả Observation lỗi để model tự điều chỉnh.

## ToolOutput được dùng thế nào

`ToolOutput` không đưa thẳng cho model dưới dạng binary object.
Nó được chuyển thành observation text:

- `Text` -> nội dung phản hồi.
- `Resource` -> URI của file trong sandbox.
- `is_error` -> prefix lỗi để model hiểu cần sửa hành động.

## Vì sao sandbox là bắt buộc

- `local_file_writer` ghi file thật.
- `chart` tạo SVG thật.
- `pdf` đọc file thật.
- `scraper` đọc dữ liệu từ URL.

Nếu không có sandbox:

- agent có thể ghi ra ngoài vùng cho phép,
- hoặc tool ghi file sẽ khó kiểm soát.

## Kết luận

Tool calling trong FlowAgent là:

- registry-driven,
- permission-gated,
- sandboxed,
- và có thể mở rộng thành agent packs.

Đây là chỗ FlowAgent khác workflow engine thuần.

