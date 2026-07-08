# Class Diagram

FlowAgent dùng Rust, nên đây là class diagram theo nghĩa "struct / trait / module" chứ không phải OOP thuần.

```mermaid
classDiagram
    class Flow {
        +flow_id
        +name
        +steps
        +validate()
        +display_name()
    }

    class Step {
        +id
        +needs
        +kind
        +with
        +step_type()
    }

    class StepType
    class AiAgentArgs {
        +model
        +goal
        +context
        +max_iterations
        +allowed_tools
    }

    class CompiledFlow {
        +order
        +levels
    }

    class RunContext {
        +run_id
        +sandbox_dir
        +initial_inputs
        +bus
    }

    class StepCtx {
        +run_id
        +step_id
        +resolved_with
        +initial_inputs
        +sandbox_dir
    }

    class NodeExec {
        <<trait>>
        +run(ctx)
    }

    class Agent {
        <<trait>>
        +id()
        +name()
        +description()
        +tools()
    }

    class Tool {
        <<trait>>
        +name()
        +description()
        +input_schema()
        +call(args, ctx)
    }

    class Registry {
        +expand_allowed()
        +dispatch()
        +prompt_schemas()
        +catalog()
    }

    class Store {
        <<trait>>
        +upsert_flow()
        +create_run()
        +set_step_status()
        +complete_step()
        +fail_step()
        +append_agent_log()
    }

    class FlowRecord
    class RunRecord
    class StepRecord
    class ManualTrigger
    class WebScraper
    class LocalFileReader
    class CoreAgent
    class PdfAgent
    class ScraperAgent
    class ChartAgent
    class SqlxStore

    Flow "1" o-- "*" Step
    Step --> StepType
    CompiledFlow --> Flow
    NodeExec <|.. ManualTrigger
    NodeExec <|.. WebScraper
    NodeExec <|.. LocalFileReader
    Agent <|.. CoreAgent
    Agent <|.. PdfAgent
    Agent <|.. ScraperAgent
    Agent <|.. ChartAgent
    Tool <|.. FileWriterTool
    Tool <|.. StringAnalyzerTool
    Tool <|.. PdfExtractTextTool
    Tool <|.. PdfMetadataTool
    Tool <|.. PdfSearchTool
    Tool <|.. ScrapeTextTool
    Tool <|.. ScrapeLinksTool
    Tool <|.. ScrapeMetadataTool
    Tool <|.. RenderChartTool
    Registry o-- "*" Agent
    Registry o-- "*" Tool
    Store <|.. SqlxStore
```

## Cách đọc diagram này

- `Flow` và `Step` là DSL model.
- `CompiledFlow` là kết quả biên dịch DAG.
- `RunContext` là môi trường runtime của một run.
- `StepCtx` là môi trường runtime của một step tuyến tính.
- `NodeExec` là trait cho built-in node.
- `Agent` và `Tool` là lớp mở rộng cho AI/tool ecosystem.
- `Registry` là hub để khai triển `allowed_tools` và dispatch tool.
- `Store` là boundary giữ core engine tách khỏi database cụ thể.

## Nhận xét kiến trúc

Thiết kế này cố tình tránh coupling trực tiếp giữa engine và backend:

- `fa-core` không biết Postgres hay MariaDB.
- `fa-api` chỉ cần `Store`.
- `fa-store` chỉ là một implementation của `Store`.

Đó là lý do FlowAgent có thể đổi backend mà không cần viết lại logic chạy flow.
