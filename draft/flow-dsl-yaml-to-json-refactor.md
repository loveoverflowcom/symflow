# Refactor: Flow DSL from YAML to JSON

> Plan for migrating flow authoring and persistence from YAML to JSON in **symflow-api** and **symflow-web**.
>
> Created: 2026-07-09

---

## Goal

Make **JSON** the canonical format for flow DSL (`dsl_script`). Users author, validate, and save JSON in the web editor; the API parses and stores JSON only.

The database column `flows.dsl_script` stays `TEXT` — only the on-disk / in-DB text format changes.

---

## Current state

| Area | What exists today |
|------|-------------------|
| `packages/symflow-core/src/dsl.rs` | `parse_json()`, `parse_yaml()`, and `parse()` auto-detect (`{` → JSON, else YAML) |
| `services/symflow-api/src/compat.rs` | Uses `serde_yaml::Value` / `Mapping` for legacy `flow_id` patching when DSL omits `flow_id` |
| `services/symflow-web/src/lib/components/DslEditor.svelte` | Validates with `yaml` npm package; YAML placeholder and labels |
| `services/symflow-web/src/lib/i18n.ts` | Copy references "YAML DSL" (EN + VI) |
| `test-data/flows/*.yaml` | Six example flows in YAML |
| `services/symflow-web/package.json` | Direct dependency on `yaml` |

**API field name** `dsl_script` is unchanged — it already holds opaque text.

**Out of scope for this plan** (follow-up after API/web land): `symflow-cli`, `packages/symflow-core` YAML removal, architecture docs under `draft/`.

---

## Target state

- Web editor shows JSON, validates with `JSON.parse`, and formats with `JSON.stringify(..., null, 2)` on save/load.
- API `parse_flow_script` accepts JSON only; legacy YAML patching reimplemented on `serde_json::Value`.
- New flows and test fixtures are `.json`.
- `yaml` npm package and `serde_yaml` usage in **symflow-api** removed (core may still carry `serde_yaml` until a later cleanup).
- Existing YAML in Postgres converted once (migration script or lazy normalize-on-read during a short transition).

### JSON shape (unchanged semantics)

```json
{
  "flow_id": "manual-echo",
  "name": "Manual Echo",
  "steps": [
    {
      "id": "receive_input",
      "type": "manual_trigger",
      "with": {
        "message": "Hello from test-data"
      }
    }
  ]
}
```

Equivalent to today's YAML; `type` (not `kind`) and `with` (not `inputs`) remain the serde field names.

---

## Phases & tasks

### Phase 0 — Decisions & inventory

- [ ] **0.1** Confirm cutover strategy:
  - **Recommended:** short transition — API accepts YAML + JSON, normalizes to JSON on save; web ships JSON-only in the same release.
  - **Alternative:** hard cutover — reject non-JSON `dsl_script` with `422` immediately.
- [ ] **0.2** Audit stored flows (Postgres + any dev MemoryStore seeds) for YAML `dsl_script` rows.
- [ ] **0.3** Agree on default new-flow template (minimal valid JSON with one `manual_trigger` step).

---

### Phase 1 — symflow-api

#### 1.1 Core parse path (prerequisite in `symflow-core`)

> symflow-api depends on `symflow_core::dsl::parse`. Do this first or in the same PR as API compat changes.

- [ ] **1.1.1** Change `dsl::parse()` to call `parse_json()` only (or try JSON first, YAML second during transition).
- [ ] **1.1.2** Add unit tests in `symflow-core` for `parse_json` with all step types (`manual_trigger`, `web_scraper`, `local_file_reader`, `ai_agent`).
- [ ] **1.1.3** *(Transition only)* Keep `parse_yaml` behind a deprecated path or feature flag until DB migration completes.

#### 1.2 Legacy compat layer

File: `services/symflow-api/src/compat.rs`

- [ ] **1.2.1** Replace `serde_yaml::{Mapping, Value}` with `serde_json::{Map, Value}`.
- [ ] **1.2.2** Rewrite `patch_legacy_flow` to operate on `serde_json::Map<String, Value>` (inject `flow_id` from path id, request `name`, or generated slug — same rules as today).
- [ ] **1.2.3** Deserialize patched document with `serde_json::from_value::<Flow>`.
- [ ] **1.2.4** *(Transition only)* If input is not valid JSON, attempt YAML parse → convert to `serde_json::Value` → patch → store as JSON string on save.

#### 1.3 Persist normalized JSON

File: `services/symflow-api/src/routes.rs` (`persist_flow`)

- [ ] **1.3.1** After successful parse + validate + compile, serialize the canonical `Flow` back to pretty JSON (`serde_json::to_string_pretty`) and persist that as `dsl_script` (ensures DB always holds JSON even if client sent YAML during transition).
- [ ] **1.3.2** Return the normalized JSON in `FlowDetail.dsl_script` responses.

#### 1.4 Dependencies & cleanup

- [ ] **1.4.1** Remove `serde_yaml` from `services/symflow-api/Cargo.toml` workspace deps and `[dependencies]` once compat no longer needs it.
- [ ] **1.4.2** Run `cargo test` / `cargo clippy` in `services/symflow-api`.

#### 1.5 API tests

- [ ] **1.5.1** Add integration tests (or `#[tokio::test]` against router) for `POST /api/flows` with valid JSON DSL.
- [ ] **1.5.2** Test `422` on malformed JSON.
- [ ] **1.5.3** Test legacy document without `flow_id` (JSON) gets `flow_id` injected from request `id` / `name`.
- [ ] **1.5.4** Test `trigger_run` re-parses stored JSON correctly.
- [ ] **1.5.5** *(Transition only)* Test YAML input is accepted, saved as JSON, and round-trips.

#### 1.6 Data migration

- [ ] **1.6.1** Add one-off migration script or SQL + Rust binary: `SELECT id, dsl_script FROM flows` → parse YAML → write JSON back.
- [ ] **1.6.2** Document rollback (keep YAML backup export before migration).
- [ ] **1.6.3** Run migration in dev/staging before enabling YAML rejection.

#### 1.7 Docs

- [ ] **1.7.1** Update `services/symflow-api/README.md` — DSL format is JSON; example request bodies use JSON `dsl_script`.
- [ ] **1.7.2** Update error messages from API (`422`) to say "invalid JSON DSL" instead of generic parse errors where applicable.

---

### Phase 2 — symflow-web

#### 2.1 Editor component

File: `services/symflow-web/src/lib/components/DslEditor.svelte`

- [ ] **2.1.1** Remove `import YAML from 'yaml'`.
- [ ] **2.1.2** Replace `YAML.parse` validation with `JSON.parse`.
- [ ] **2.1.3** Update placeholder to a minimal JSON flow (match `flow_id` / `steps` / `type` / `with` schema).
- [ ] **2.1.4** *(Optional UX)* Add "Format JSON" button using `JSON.stringify(JSON.parse(value), null, 2)`.
- [ ] **2.1.5** Rename component labels from "YAML DSL" to "JSON DSL" (via i18n keys).

#### 2.2 i18n

File: `services/symflow-web/src/lib/i18n.ts`

- [ ] **2.2.1** Rename keys: `yamlDsl` → `jsonDsl`, `validYaml` → `validJson`, `invalidYaml` → `invalidJson` (or keep keys, change strings only).
- [ ] **2.2.2** Update EN copy: "JSON DSL", "DSL is valid JSON.", editor subtitles, empty-state descriptions.
- [ ] **2.2.3** Update VI copy to match.

#### 2.3 Default / new flow experience

Files: `services/symflow-web/src/routes/flows/new/*`, `shared-editor.svelte`

- [ ] **2.3.1** Seed `dslScript` for new flows with the agreed JSON template (not YAML).
- [ ] **2.3.2** When loading an existing flow, pretty-print JSON if the API returns compact JSON (client-side `JSON.parse` + `stringify`).

#### 2.4 Mock API & tests

Files: `services/symflow-web/src/lib/api/mock.ts`, `services/symflow-web/tests/mock-api.test.ts`

- [ ] **2.4.1** Replace demo `dsl_script` YAML string with equivalent JSON.
- [ ] **2.4.2** Update test fixtures (`name: test-flow\nsteps: []` → `{"name":"test-flow","steps":[]}` or full schema).
- [ ] **2.4.3** Add a small unit test for `DslEditor` validation logic (extract `validateDsl` to `$lib/utils/dsl.ts` if needed for testability).

#### 2.5 Dependencies

- [ ] **2.5.1** Remove `yaml` from `services/symflow-web/package.json`.
- [ ] **2.5.2** Run `npm install` and verify `package-lock.json` no longer lists `yaml` as a direct dependency.
- [ ] **2.5.3** Run `npm run check` and `npm run test`.

#### 2.6 Docs

- [ ] **2.6.1** Update `services/symflow-web/README.md` if it mentions YAML authoring.

---

### Phase 3 — Test data & repo fixtures

- [ ] **3.1** Convert `test-data/flows/*.yaml` → `test-data/flows/*.json` (six files).
- [ ] **3.2** Update `test-data/README.md` — paste JSON into the editor; remove YAML references.
- [ ] **3.3** Remove `.yaml` flow fixtures after JSON versions are verified against API validate + run.
- [ ] **3.4** *(Optional)* Add `scripts/convert-flow-yaml-to-json.sh` for one-time local conversion.

---

### Phase 4 — End-to-end verification

- [ ] **4.1** Create flow in web UI with JSON → save → reload → content matches.
- [ ] **4.2** Trigger run from saved JSON flow; steps execute as before.
- [ ] **4.3** Paste each `test-data/flows/*.json` into editor; validate + save + run (where LLM/sandbox prerequisites allow).
- [ ] **4.4** Confirm `GET /api/flows/:id` returns JSON `dsl_script` after save.
- [ ] **4.5** Run full dev stack: `cargo make api-dev` + `npm run dev` against Postgres with migrated data.

---

## File checklist

| File | Action |
|------|--------|
| `packages/symflow-core/src/dsl.rs` | JSON-first `parse()`; tests |
| `services/symflow-api/src/compat.rs` | `serde_json` legacy patch |
| `services/symflow-api/src/routes.rs` | Normalize to JSON on persist |
| `services/symflow-api/Cargo.toml` | Drop `serde_yaml` |
| `services/symflow-web/src/lib/components/DslEditor.svelte` | JSON validate + placeholder |
| `services/symflow-web/src/lib/i18n.ts` | Copy updates |
| `services/symflow-web/src/lib/api/mock.ts` | JSON demo data |
| `services/symflow-web/tests/mock-api.test.ts` | JSON fixtures |
| `services/symflow-web/package.json` | Remove `yaml` |
| `test-data/flows/*` | `.yaml` → `.json` |
| `test-data/README.md` | JSON instructions |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Existing Postgres rows hold YAML | Migration script + transition accept YAML, save as JSON |
| Users have bookmarks/snippets in YAML | Release note; optional import that converts YAML client-side once |
| `compat.rs` slug / `flow_id` logic diverges during rewrite | Port tests from current behavior before deleting YAML path |
| Multiline `goal` / `context` in JSON need escaping | Editor pretty-print; document string newlines in test-data examples |
| symflow-cli still reads `.yaml` files | Keep CLI on YAML temporarily or add `.json` support in a follow-up |

---

## Suggested PR order

1. **PR 1 — symflow-core:** JSON-first parse + unit tests (no behavior break if YAML fallback kept).
2. **PR 2 — symflow-api:** JSON compat, normalize-on-save, API tests, drop `serde_yaml` from api crate.
3. **PR 3 — symflow-web:** Editor, i18n, mock, remove `yaml` package.
4. **PR 4 — test-data + migration:** Convert fixtures, DB migration script, README updates.

---

## Acceptance criteria

- [ ] No YAML-specific dependencies in **symflow-web**.
- [ ] No `serde_yaml` in **symflow-api** crate.
- [ ] Web UI labels and validation refer to JSON only.
- [ ] All `test-data/flows` examples are JSON and run successfully.
- [ ] API returns and stores pretty-printed JSON for `dsl_script`.
- [ ] Existing deployments can migrate stored YAML without manual re-entry.
