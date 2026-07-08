# FlowAgent Architecture Docs

Đây là bộ tài liệu kiến trúc tách theo chủ đề cho FlowAgent.
Mục tiêu là để người đọc mới mở từng file là hiểu ngay một lát cắt của hệ thống,
thay vì phải đọc một tài liệu duy nhất quá dài.

## Nguồn cần thiết đã chọn

Mình chỉ giữ các nguồn thật sự cần cho kiến trúc hiện tại:

- `flowagent_engine.md`: nguồn tổng thể về vision, scope, runtime, API contract.
- `flowagent/crates/fa-core/src/{lib,dsl,compiler,resolver,executor,state,events,sandbox,store}.rs`
- `flowagent/crates/fa-core/src/{protocol,tools}.rs`
- `flowagent/crates/fa-core/src/{agent/*,agents/*,nodes/*}.rs`
- `flowagent/crates/fa-store/src/{models,store,repositories/*}.rs`
- `flowagent/crates/fa-store/migrations/{postgres,mariadb}/0001_init.sql`
- `flowagent/crates/fa-api/src/{main,state,dto,ws,routes/*}.rs`
- `flowagent/app/lib/{app,routing/app_router,core/network/*,data/models/*,features/*}.dart`

Lý do: các file này đủ để suy ra

- kiến trúc tổng thể,
- flow chạy runtime,
- sequence call agent/tool,
- mô hình dữ liệu,
- quan hệ module/package,
- và contract FE ↔ BE.

## Cách đọc

Đọc theo thứ tự này nếu muốn hiểu nhanh:

1. `01_architecture_overview.md`
2. `02_execution_flow.md`
3. `03_sequence_diagram.md`
4. `07_state_machine.md`
5. `08_data_flow_diagram.md`
6. `09_er_diagram.md`
7. `10_ai_agent_lifecycle.md`
8. `11_tool_calling_flow.md`
9. `04_class_diagram.md`
10. `05_package_diagram.md`
11. `06_module_dependency_graph.md`

## Bộ tài liệu

- [01 Architecture Overview](01_architecture_overview.md)
- [02 Execution Flow](02_execution_flow.md)
- [03 Sequence Diagram](03_sequence_diagram.md)
- [04 Class Diagram](04_class_diagram.md)
- [05 Package Diagram](05_package_diagram.md)
- [06 Module Dependency Graph](06_module_dependency_graph.md)
- [07 State Machine](07_state_machine.md)
- [08 Data Flow Diagram](08_data_flow_diagram.md)
- [09 ER Diagram](09_er_diagram.md)
- [10 AI Agent Lifecycle](10_ai_agent_lifecycle.md)
- [11 Tool Calling Flow](11_tool_calling_flow.md)

## Nhận xét ngắn

FlowAgent không phải một workflow engine thuần.
Nó là một stack gồm 4 lớp:

- DSL compiler cho phần deterministic,
- DAG scheduler cho orchestration,
- agent runtime cho phần suy luận,
- và tool/sandbox/runtime cho phần hành động thực tế.

Điểm mạnh của cách chia này là dễ audit và dễ mở rộng.
Điểm yếu là yêu cầu toolchain và kỷ luật kiến trúc cao hơn code-first thuần túy.

