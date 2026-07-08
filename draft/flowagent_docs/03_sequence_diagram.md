# Sequence Diagram

File này mô tả chuỗi message khi chạy một `ai_agent`.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Flutter
    participant API as fa-api
    participant Executor as fa-core::executor
    participant Store as fa-store
    participant Agent as Agent Runtime
    participant LLM as LLM
    participant Registry as Tool Registry
    participant Tool as Tool
    participant FS as Filesystem Sandbox
    participant WS as WebSocket Stream

    User->>Flutter: Click Run
    Flutter->>API: POST /api/flows/{id}/runs
    API->>Store: create_run(flow_id, initial_inputs)
    API->>Executor: run_flow(flow, ctx)
    Executor->>Store: upsert_step(PENDING)
    Executor->>Store: set_run_status(RUNNING)
    API-->>Flutter: run_id + status

    loop each ai_agent iteration
        Executor->>Agent: run_agent(args, run_id, step_id)
        Agent->>LLM: chat(history)
        LLM-->>Agent: Thought / Action / Final Answer

        alt Final Answer
            Agent->>Store: append_agent_log(final)
            Agent-->>Executor: outputs
            Executor->>Store: complete_step(outputs)
        else Action
            Agent->>Registry: expand_allowed + permission check
            Registry->>Tool: dispatch(tool, args)
            Tool->>FS: read/write sandbox
            FS-->>Tool: file/content
            Tool-->>Agent: ToolOutput
            Agent->>Store: append_agent_log(observation)
            Agent-->>Executor: continue
        end
    end

    Executor->>Store: set_run_status(SUCCESS/FAILED)
    Executor-->>WS: RunEvent stream
    WS-->>Flutter: Thought / Action / Observation / Final / Status
```

## Message flow quan trọng

- `Flutter -> fa-api`: chỉ gửi JSON REST/WS.
- `fa-api -> Executor`: chuyển sang core runtime.
- `Executor -> Agent Runtime`: chỉ khi step là `ai_agent`.
- `Agent Runtime -> LLM`: một vòng gọi model.
- `Agent Runtime -> Registry -> Tool`: kiểm tra quyền rồi mới dispatch.
- `Tool -> Filesystem Sandbox`: nơi duy nhất tool được phép chạm file.
- `Executor -> Store`: mọi trạng thái đều đi qua store.
- `Executor -> WS -> Flutter`: log realtime cho UI.

## Điều cần nhớ

- `Observation` không phải output cuối cùng của tool.
- `Observation` là dữ liệu được nối trở lại history để vòng ReAct tiếp tục.
- `RunEvent` và `agent_logs` là hai kênh biểu diễn cùng một sự kiện: một cho realtime UI, một cho lưu trữ/audit.

