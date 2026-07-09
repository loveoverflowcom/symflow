# Guide: Unit Tests for JSON Flow Nodes and Agent Nodes

> How to write tests for Symflow flow DSL (JSON steps) and agent/tool nodes.
>
> Primary crates: `packages/symflow-core`, `services/symflow-api`
>
> Fixtures: `test-data/flows/*.json`

---

## Terminology

Symflow uses two related concepts that tests should keep separate:

| Concept | Where it lives | JSON field | Examples |
|---------|----------------|------------|----------|
| **Flow step node** | `Flow.steps[]` in DSL JSON | `"type"` | `manual_trigger`, `web_scraper`, `local_file_reader`, `ai_agent` |
| **Agent node** | `packages/symflow-core/src/agents/*` | N/A (runtime registry) | `core`, `pdf`, `scraper`, `chart` |
| **Tool** | Registered under an agent | `ai_agent.with.allowed_tools` | `local_file_writer`, `render_chart`, `pdf_extract_text` |

- A **flow step** is what users author in `dsl_script`.
- An **agent** is a bundle of tools exposed through `GET /api/agents`.
- An **`ai_agent` step** does not implement `NodeExec`; the executor calls the ReAct runtime and dispatches **tools** listed in `allowed_tools`.

---

## JSON shapes to test

### Flow document

```json
{
  "flow_id": "my-flow",
  "name": "My Flow",
  "steps": [
    {
      "id": "step_id",
      "type": "manual_trigger",
      "needs": [],
      "with": {}
    }
  ]
}
```

Serde mapping (`packages/symflow-core/src/dsl.rs`):

- `type` → `Step.kind` (not `kind` in JSON)
- `with` → step arguments object (not `inputs`)
- `needs` → dependency list for DAG edges

### Step `with` contracts

| `type` | Required `with` fields | Validated by |
|--------|------------------------|--------------|
| `manual_trigger` | object or `{}` | `Flow::validate` |
| `web_scraper` | `url` (string) | `WebScraperArgs` |
| `local_file_reader` | `path` (string; alias `filename`) | `FileReaderArgs` |
| `ai_agent` | `goal` (string); `model` or env `LLM_MODEL` | `AiAgentArgs` + `allowed_tools` registry check |

### `ai_agent` step example

```json
{
  "id": "analyze",
  "type": "ai_agent",
  "needs": ["scrape_page"],
  "with": {
    "model": "gpt-4o-mini",
    "goal": "Summarize the text.",
    "context": "Text:\n{{steps.scrape_page.raw_text}}\n",
    "max_iterations": 4,
    "allowed_tools": ["string_analyzer"]
  }
}
```

`allowed_tools` may list **tool names** (`string_analyzer`) or **agent ids** (`core` → expands to all tools on that agent).

### Agent tool call args (separate from flow JSON)

When testing tools directly, pass the tool argument object — not a full flow step:

```json
{ "filename": "note.txt", "content": "hello" }
```

---

## Test layers (bottom → top)

Use the narrowest layer that proves the behavior you care about.

```
parse_json ──► Flow::validate ──► compiler::compile ──► node/tool unit ──► executor ──► API
```

| Layer | What it proves | Sync/async | Mock network/LLM? |
|-------|----------------|------------|-------------------|
| 1. Parse | JSON deserializes into `Flow` / `Step` | sync | No |
| 2. Validate | Per-step `with` rules, unknown `type`, bad tools | sync | No |
| 3. Compile | DAG order, cycles, duplicate ids, missing `needs` | sync | No |
| 4. Node / tool | Single step or tool behavior | usually `#[tokio::test]` | Prefer local/sandbox only |
| 5. Executor | Multi-step, `{{steps.*}}` resolution, run status | `#[tokio::test]` | Mock HTTP for scraper if needed |
| 6. API | HTTP contract, normalize JSON on save | `#[tokio::test]` + router | MemoryStore, no LLM |

---

## Where to put tests

Co-locate tests in the same Rust module with `#[cfg(test)] mod tests { ... }`.

| Area | File | Existing examples |
|------|------|-------------------|
| DSL parse + validate | `packages/symflow-core/src/dsl.rs` | `parse_json_supports_every_step_type`, `json_test_data_flows_parse_and_validate` |
| API compat / legacy patch | `services/symflow-api/src/compat.rs` | `injects_path_id_into_legacy_json_document` |
| Executor + flow nodes | `packages/symflow-core/src/executor.rs` | `manual_trigger_initial_inputs_override_defaults_and_resolve_downstream` |
| Agent tools | `packages/symflow-core/src/agents/*.rs` | `agents/pdf.rs` → `pdf_tools_can_read_sample_pdf` |
| HTTP flows API | `services/symflow-api/src/routes.rs` | `post_json_persists_and_returns_pretty_json` |

Add new **flow step node** tests next to the node in `packages/symflow-core/src/nodes/<name>.rs`.
Add new **agent tool** tests next to the agent in `packages/symflow-core/src/agents/<name>.rs`.

---

## Running tests

```bash
# All symflow-core tests
cd services/symflow-api
cargo test -p symflow-core

# One module
cargo test -p symflow-core parse_json_supports_every_step_type

# API route tests
cargo test -p symflow-api post_json_persists

# With output on failure
cargo test -p symflow-core -- --nocapture
```

Fixture-driven test `json_test_data_flows_parse_and_validate` reads every `test-data/flows/*.json` file. When adding a fixture, ensure it parses, validates, and compiles — or the test count assertion will fail.

---

## Layer 1 — Parse tests

**Goal:** JSON syntax and serde mapping are correct.

### Happy path template

```rust
#[test]
fn parse_manual_trigger_step() {
    let flow = symflow_core::dsl::parse_json(
        r#"{
          "flow_id": "t",
          "steps": [{
            "id": "start",
            "type": "manual_trigger",
            "with": { "message": "hi" }
          }]
        }"#,
    )
    .expect("valid JSON");

    assert_eq!(flow.steps.len(), 1);
    assert_eq!(flow.steps[0].kind, "manual_trigger");
}
```

### Cases to cover per step type

- [ ] Minimal valid document (only required fields)
- [ ] Full document with `name`, `needs`, and populated `with`
- [ ] `local_file_reader` accepts `"filename"` alias for `path`
- [ ] Multiline strings in `goal` / `context` for `ai_agent`

### Negative parse cases

- [ ] Malformed JSON (`{"flow_id": broken,]`) → `CompileError::Parse`
- [ ] Missing `steps` or wrong types (`"steps": "nope"`)
- [ ] Step missing `id` or `type`

Use `parse_json` directly in unit tests. Reserve `parse()` for transitional YAML coverage only.

---

## Layer 2 — Validate tests

**Goal:** Business rules after deserialization.

Call `flow.validate()` and assert on `CompileError` variants (`packages/symflow-core/src/error.rs`).

### Flow step matrix

| Step `type` | Valid input | Expected error |
|-------------|-------------|----------------|
| `manual_trigger` | `"with": {}` | — |
| `manual_trigger` | `"with": "string"` | `InvalidStep` |
| `web_scraper` | `"with": {"url": "https://x"}` | — |
| `web_scraper` | `"with": {}` | `InvalidStep` (missing `url`) |
| `local_file_reader` | `"with": {"path": "a.txt"}` | — |
| `ai_agent` | `"with": {"goal": "x", "model": "m"}` | — |
| `ai_agent` | `"with": {"goal": "x"}` without `LLM_MODEL` env | `InvalidStep` |
| `ai_agent` | `"allowed_tools": ["not_a_real_tool"]` | `InvalidStep` |
| any | `"type": "unknown_kind"` | `UnknownStepType` |

### Agent capability validation

`ai_agent` validation calls `tools::is_known_capability` (`packages/symflow-core/src/tools/mod.rs`).

Test both forms:

```rust
// tool name
"allowed_tools": ["string_analyzer"]

// agent id (expands at runtime, but id alone must be known)
"allowed_tools": ["core"]
```

Registered agents today: `core`, `pdf`, `scraper`, `chart`.

---

## Layer 3 — Compile tests

**Goal:** DAG structure is valid.

```rust
let flow = symflow_core::dsl::parse_json(json).unwrap();
flow.validate().unwrap();
let compiled = symflow_core::compiler::compile(&flow).unwrap();
assert_eq!(compiled.order, vec!["a", "b", "c"]);
```

### Cases

- [ ] Linear chain `a → b → c` → topological order
- [ ] Parallel branches at same level → `compiled.levels` grouping
- [ ] Duplicate step `id` → `CompileError::DuplicateId`
- [ ] `needs` references missing step → `CompileError::UnknownDependency`
- [ ] Cycle `a needs b`, `b needs a` → `CompileError::Cycle`

No I/O at this layer.

---

## Layer 4a — Flow node unit tests

Flow step implementations live in `packages/symflow-core/src/nodes/`.

| Node | Struct | Test focus |
|------|--------|------------|
| `manual_trigger` | `ManualTriggerNode` | `apply_initial_inputs` merges run inputs over `with` defaults |
| `web_scraper` | `WebScraperNode` | HTTP fetch + text extraction (mock or stub URL) |
| `local_file_reader` | `LocalFileReaderNode` | Reads file inside sandbox; rejects traversal |

### `manual_trigger` — pure function test (no async)

```rust
use serde_json::json;
use symflow_core::nodes::manual_trigger::apply_initial_inputs;

#[test]
fn initial_inputs_override_defaults() {
    let defaults = json!({ "url": "https://default.com", "keep": true });
    let inputs = json!({ "url": "https://override.com" });
    let merged = apply_initial_inputs(defaults, &inputs);
    assert_eq!(merged["url"], "https://override.com");
    assert_eq!(merged["keep"], true);
}
```

### `local_file_reader` — sandbox test

Pattern: temp dir → write file → `StepCtx` with `sandbox_dir` → `node.run(&ctx)`.

Assert output shape:

```json
{ "content": "...", "path": "sample.txt", "size": 12 }
```

### `web_scraper` — prefer offline HTML

Avoid live network in unit tests. Options:

1. Test `extract_text` helper with inline HTML string (if extracted to testable fn).
2. Use `wiremock` / custom reqwest client (only if you inject client; not available today).
3. Keep HTTP tests as `#[ignore]` integration tests.

Default recommendation: unit-test HTML parsing; leave live URL tests to `test-data` manual runs.

---

## Layer 4b — Agent node / tool unit tests

Agents implement `protocol::Agent`; tools implement `protocol::Tool`.

**Reference implementation:** `packages/symflow-core/src/agents/pdf.rs` (`#[cfg(test)]`).

### Tool test template

```rust
#[tokio::test]
async fn string_analyzer_counts_words() {
    use serde_json::json;
    use symflow_core::agents::core::StringAnalyzer;
    use symflow_core::protocol::{Tool, ToolContext};

    let ctx = ToolContext {
        sandbox_dir: std::env::temp_dir().join("symflow-tool-test"),
    };
    let out = StringAnalyzer
        .call(json!({ "text": "one two three", "keyword": "two" }), &ctx)
        .await
        .unwrap();

    assert!(out.to_text().contains("word_count=3"));
    assert!(out.to_text().contains("keyword_'two'_count=1"));
}
```

### Agent / tool coverage matrix

| Agent id | Tool name | Args to test | Notes |
|----------|-----------|--------------|-------|
| `core` | `local_file_writer` | `filename`, `content` | Assert file exists in sandbox |
| `core` | `string_analyzer` | `text`, optional `keyword` | Pure, no I/O |
| `pdf` | `pdf_extract_text` | `filename` | Build minimal PDF in test (see `pdf.rs`) |
| `pdf` | `pdf_metadata` | `filename` | Same fixture |
| `pdf` | `pdf_search` | `filename`, `keyword` | Same fixture |
| `scraper` | `scrape_text` | `url` | Prefer mocked HTML or `#[ignore]` |
| `chart` | `render_chart` | `filename`, `type`, `labels`, `values` | Assert SVG file written |

### Tool negative cases

- [ ] Missing required field → `ToolError::InvalidArgs`
- [ ] Unknown tool via `tools::dispatch` → `ToolError::Unknown`
- [ ] Path outside sandbox → `ToolError::Sandbox`
- [ ] `render_chart` mismatched `labels` / `values` length → `InvalidArgs`

### Registry tests (optional, in `protocol.rs` or `tools/mod.rs`)

```rust
#[test]
fn expand_allowed_expands_agent_id_to_tools() {
    let registry = symflow_core::agents::default_registry();
    let expanded = registry.expand_allowed(&["core".to_string()]);
    assert!(expanded.contains(&"local_file_writer".to_string()));
    assert!(expanded.contains(&"string_analyzer".to_string()));
}
```

---

## Layer 5 — Executor integration tests

**Goal:** JSON step definitions behave correctly through `run_flow`.

Existing pattern: `packages/symflow-core/src/executor.rs`.

```rust
#[tokio::test]
async fn resolves_template_in_with() {
    use symflow_core::dsl::{Flow, Step};
    use symflow_core::executor::{run_flow, RunContext};
    use symflow_core::mem::MemoryStore;
    use serde_json::json;

    let flow = Flow {
        flow_id: "resolve-test".into(),
        name: String::new(),
        steps: vec![
            Step {
                id: "upstream".into(),
                needs: vec![],
                kind: "manual_trigger".into(),
                with: json!({ "url": "https://example.com" }),
            },
            Step {
                id: "downstream".into(),
                needs: vec!["upstream".into()],
                kind: "manual_trigger".into(),
                with: json!({ "seen": "{{steps.upstream.url}}" }),
            },
        ],
    };
    // ... MemoryStore, RunContext, run_flow, assert step outputs
}
```

### Recommended scenarios

| Scenario | Steps | Assert |
|----------|-------|--------|
| Manual input override | `manual_trigger` + `initial_inputs` | Resolved inputs use override |
| Template resolution | `manual_trigger` → step with `{{steps.*}}` | Downstream sees upstream output |
| File read chain | `manual_trigger` → `local_file_reader` | `content` in outputs |
| Invalid `needs` order | compile fails before executor | `CompileError` |

### `ai_agent` steps in executor tests

Full ReAct + LLM calls are **slow and flaky** in unit tests. Options:

- **Do not** run LLM in default `cargo test`; use `#[ignore]` + env vars for manual runs.
- Test only argument parsing: invalid `with` → step fails with message containing `ai_agent`.
- Mock at the `agent` module boundary if you add injection later.

---

## Layer 6 — API tests (JSON `dsl_script`)

**File:** `services/symflow-api/src/routes.rs` (`#[cfg(test)]`).

Uses `router(test_state())` + `tower::ServiceExt::oneshot`.

### Cases already covered (extend, do not duplicate blindly)

- [ ] POST valid JSON DSL → 200, pretty-printed `dsl_script` in response
- [ ] Malformed JSON → 422 with `invalid JSON DSL`
- [ ] Legacy JSON without `flow_id` → injected from request `id`
- [ ] Legacy YAML on save → stored as JSON; run still accepted

### Add when touching new step types

```rust
let payload = json!({
    "name": "Chart flow",
    "dsl_script": include_str!("../../../test-data/flows/chart-agent.json")
});
// POST /api/flows → 200, validate response dsl_script parses
```

Use `include_str!` for fixtures to avoid drift between `test-data` and API tests.

---

## Fixture-driven tests (recommended default)

When adding or changing a flow JSON file under `test-data/flows/`:

1. Ensure `flow_id` matches filename stem.
2. Run parse → validate → compile (already enforced by `json_test_data_flows_parse_and_validate`).
3. For behavior-heavy flows, add a focused unit test that `include_str!` the same file.

| Fixture | Step types covered | Suggested extra test |
|---------|-------------------|----------------------|
| `manual-echo.json` | `manual_trigger` | Executor with matching `initial_inputs` |
| `local-file-reader.json` | `local_file_reader` | Node test with sandbox file |
| `web-scrape-example.json` | `web_scraper` | `#[ignore]` network test |
| `scrape-and-analyze-agent.json` | chain + `ai_agent` | Validate only in CI |
| `write-file-agent.json` | `ai_agent` + `local_file_writer` | Tool unit test for writer |
| `chart-agent.json` | `ai_agent` + `render_chart` | Tool unit test for chart |

---

## Checklist: new flow step node

- [ ] Add `StepType` variant and `StepType::parse` arm in `dsl.rs`
- [ ] Add typed `*Args` struct if `with` has required fields
- [ ] Extend `Flow::validate` match arm
- [ ] Implement `NodeExec` in `nodes/<name>.rs` and register in `build_node`
- [ ] **Tests:**
  - [ ] `parse_json` minimal + full `with`
  - [ ] `validate` positive + negative
  - [ ] `compile` with `needs` if applicable
  - [ ] `node.run` or pure helper unit test
  - [ ] Optional: executor chain test
  - [ ] Add `test-data/flows/<name>.json` fixture

---

## Checklist: new agent or tool

- [ ] Implement `Agent` in `agents/<name>.rs`
- [ ] Register in `agents::default_registry()`
- [ ] **Tests:**
  - [ ] `input_schema()` returns expected JSON Schema shape
  - [ ] `call()` happy path with `ToolContext { sandbox_dir }`
  - [ ] `call()` missing/invalid args
  - [ ] `is_known_capability(tool.name())` and `is_known_capability(agent.id())`
  - [ ] If referenced from DSL: sample `ai_agent` step in a fixture with tool in `allowed_tools`

---

## Assertions cheat sheet

```rust
// Parse failure
let err = symflow_core::dsl::parse_json(bad).unwrap_err();
assert!(matches!(err, symflow_core::error::CompileError::Parse(_)));

// Validate failure
let flow = symflow_core::dsl::parse_json(json).unwrap();
let err = flow.validate().unwrap_err();
assert!(matches!(err, symflow_core::error::CompileError::InvalidStep { .. }));

// Tool failure
let err = tool.call(args, &ctx).await.unwrap_err();
assert!(matches!(err, symflow_core::error::ToolError::InvalidArgs(_)));

// JSON value
use serde_json::json;
assert_eq!(output["path"], json!("sample.txt"));
```

---

## Anti-patterns

| Avoid | Prefer |
|-------|--------|
| Live HTTP to `example.com` in default unit tests | Inline HTML or `#[ignore]` integration test |
| Calling OpenAI/LLM in `cargo test` | Validate `ai_agent` DSL only; ignore full agent runs |
| Duplicating large JSON literals in many files | `include_str!("../../test-data/flows/...")` |
| Testing YAML in new tests | JSON only (`parse_json`) |
| Asserting exact error strings (fragile) | `matches!` on error enum or `assert!(err.to_string().contains("url"))` |

---

## Related files

| Path | Role |
|------|------|
| `packages/symflow-core/src/dsl.rs` | `Flow`, `Step`, parse, validate |
| `packages/symflow-core/src/compiler.rs` | DAG compile |
| `packages/symflow-core/src/nodes/` | Flow step executors |
| `packages/symflow-core/src/agents/` | Agent + tool implementations |
| `packages/symflow-core/src/protocol.rs` | `Agent`, `Tool`, `Registry` traits |
| `packages/symflow-core/src/tools/mod.rs` | Dispatch + capability checks |
| `packages/symflow-core/src/executor.rs` | `run_flow` orchestration |
| `services/symflow-api/src/compat.rs` | Legacy JSON/YAML patching |
| `test-data/flows/*.json` | Canonical flow fixtures |
