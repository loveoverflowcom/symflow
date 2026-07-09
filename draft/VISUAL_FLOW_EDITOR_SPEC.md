# Visual Flow Editor – Upgrade Specification

> **Mục đích của tài liệu này:** Hướng dẫn chi tiết cho agent AI thực thi việc nâng cấp `symflow-web` từ giao diện editor JSON thuần text thành **giao diện kéo thả node** (drag-and-drop node canvas) giống n8n / Gumloop, sử dụng thư viện `@xyflow/svelte` (Svelte Flow).

---

## 1. Bối cảnh & Mục tiêu

### Trạng thái hiện tại

Trang `/flows/[id]` và `/flows/new` hiện dùng component `DslEditor.svelte` – một `<textarea>` hiển thị raw JSON DSL. Người dùng phải viết tay JSON để định nghĩa các bước (steps) của flow.

**DSL format hiện tại** (từ `src/lib/utils/dsl.ts`):

```json
{
  "flow_id": "my-flow",
  "name": "My Flow",
  "steps": [
    {
      "id": "receive_input",
      "type": "manual_trigger",
      "with": {
        "message": "Hello from Symflow"
      }
    }
  ]
}
```

Các node types đã biết: `manual_trigger`, `local_file_reader`, `web_scraper`, và các agent nodes từ `src/agents/`.

### Mục tiêu nâng cấp

Thay thế `DslEditor.svelte` bằng canvas tương tác `@xyflow/svelte`, trong đó:

- Mỗi **step** trong DSL JSON = một **node** trên canvas
- Các liên kết giữa các steps (qua trường `depends_on` hoặc thứ tự mảng) = các **edge** trên canvas
- Người dùng kéo thả để thêm/di chuyển/xóa nodes
- Khi lưu, canvas serialize ngược trở lại thành DSL JSON để gửi lên API (API không thay đổi)

---

## 2. Cài đặt Dependencies

```bash
# Chạy trong thư mục: services/symflow-web
npm install @xyflow/svelte
```

Không cần cài thêm bất kỳ dependency nào khác. Thư viện hỗ trợ Svelte 5 (dự án đang dùng `svelte@^5.56.3`).

---

## 3. Cấu trúc File cần tạo mới

```
src/
  lib/
    components/
      flow-canvas/
        FlowCanvas.svelte          # Component canvas chính (wrapper SvelteFlow)
        NodePalette.svelte         # Thanh sidebar liệt kê node types có thể kéo thả
        nodes/
          BaseNode.svelte          # Base layout cho tất cả custom nodes
          ManualTriggerNode.svelte # Node type: manual_trigger
          WebScraperNode.svelte    # Node type: web_scraper
          LocalFileReaderNode.svelte # Node type: local_file_reader
          AgentNode.svelte         # Node type: agent (chart, core, pdf, scraper agents)
        NodeConfigPanel.svelte     # Panel hiện thị khi click vào node để chỉnh sửa config
    utils/
      flow-graph.ts                # Utilities chuyển đổi DSL JSON ↔ Svelte Flow nodes/edges
```

---

## 4. Chi tiết Implementation

### 4.1. Utility: `flow-graph.ts`

File này chứa logic **quan trọng nhất** – chuyển đổi hai chiều giữa DSL và graph.

```typescript
// src/lib/utils/flow-graph.ts
import type { Node, Edge } from '@xyflow/svelte';

export interface DslStep {
  id: string;
  type: string;
  depends_on?: string[];  // optional: explicit dependencies
  with?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DslFlow {
  flow_id: string;
  name: string;
  steps: DslStep[];
}

/**
 * Chuyển DSL JSON → Svelte Flow nodes + edges.
 * Layout tự động: xếp nodes theo chiều ngang, cách nhau 200px.
 */
export function dslToGraph(dsl: DslFlow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = dsl.steps.map((step, index) => ({
    id: step.id,
    type: mapStepTypeToNodeType(step.type),
    position: { x: index * 250, y: 100 },
    data: {
      label: step.id,
      stepType: step.type,
      config: step.with ?? {},
    },
  }));

  // Build edges từ depends_on hoặc suy ra từ thứ tự tuần tự
  const edges: Edge[] = [];
  dsl.steps.forEach((step, index) => {
    if (step.depends_on && step.depends_on.length > 0) {
      step.depends_on.forEach((dep) => {
        edges.push({
          id: `${dep}->${step.id}`,
          source: dep,
          target: step.id,
          animated: true,
        });
      });
    } else if (index > 0) {
      // Nếu không có depends_on rõ ràng, kết nối tuần tự
      const prev = dsl.steps[index - 1];
      edges.push({
        id: `${prev.id}->${step.id}`,
        source: prev.id,
        target: step.id,
        animated: false,
      });
    }
  });

  return { nodes, edges };
}

/**
 * Chuyển Svelte Flow nodes + edges → DSL JSON.
 * Được gọi khi user nhấn Save.
 */
export function graphToDsl(
  flowId: string,
  flowName: string,
  nodes: Node[],
  edges: Edge[]
): DslFlow {
  // Topo-sort nodes theo thứ tự edges
  const order = topoSort(nodes.map((n) => n.id), edges);

  const steps: DslStep[] = order.map((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId)!;
    const deps = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    return {
      id: node.id,
      type: node.data.stepType as string,
      ...(deps.length > 1 ? { depends_on: deps } : {}),
      with: node.data.config as Record<string, unknown>,
    };
  });

  return { flow_id: flowId, name: flowName, steps };
}

function mapStepTypeToNodeType(stepType: string): string {
  const map: Record<string, string> = {
    manual_trigger: 'manualTrigger',
    web_scraper: 'webScraper',
    local_file_reader: 'localFileReader',
  };
  return map[stepType] ?? 'agentNode';
}

/** Kahn's algorithm topological sort */
function topoSort(ids: string[], edges: Edge[]): string[] {
  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));

  edges.forEach(({ source, target }) => {
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    adj.get(source)?.push(target);
  });

  const queue = ids.filter((id) => inDegree.get(id) === 0);
  const result: string[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    result.push(node);
    adj.get(node)?.forEach((neighbor) => {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    });
  }
  return result.length === ids.length ? result : ids; // fallback nếu có cycle
}
```

---

### 4.2. Custom Node: `BaseNode.svelte`

Tất cả node types kế thừa layout này.

```svelte
<!-- src/lib/components/flow-canvas/nodes/BaseNode.svelte -->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  let {
    data,
    selected = false,
    isSource = true,
    isTarget = true,
    accentColor = '#6366f1',
    icon = '⚙️',
  } = $props<{
    data: { label: string; stepType: string; config: Record<string, unknown> };
    selected?: boolean;
    isSource?: boolean;
    isTarget?: boolean;
    accentColor?: string;
    icon?: string;
  }>();
</script>

<div class="node" class:selected style="--accent: {accentColor}">
  {#if isTarget}
    <Handle type="target" position={Position.Left} />
  {/if}

  <div class="node-header">
    <span class="node-icon">{icon}</span>
    <span class="node-type">{data.stepType}</span>
  </div>
  <div class="node-body">
    <span class="node-label">{data.label}</span>
  </div>

  {#if isSource}
    <Handle type="source" position={Position.Right} />
  {/if}
</div>

<style>
  .node {
    background: #1e1e2e;
    border: 2px solid #3b3b5c;
    border-radius: 8px;
    min-width: 160px;
    font-family: sans-serif;
    transition: border-color 0.15s;
  }
  .node.selected {
    border-color: var(--accent);
  }
  .node-header {
    background: var(--accent);
    padding: 6px 10px;
    border-radius: 6px 6px 0 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #fff;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .node-body {
    padding: 8px 10px;
    font-size: 13px;
    color: #cdd6f4;
  }
  .node-icon { font-size: 14px; }
  .node-label { font-weight: 500; }
</style>
```

---

### 4.3. Các Node Types

**`ManualTriggerNode.svelte`** – `isTarget={false}` (không có Handle vào, là điểm bắt đầu):

```svelte
<script lang="ts">
  import BaseNode from './BaseNode.svelte';
  let { data, selected } = $props();
</script>
<BaseNode {data} {selected} isTarget={false} accentColor="#10b981" icon="▶" />
```

**`WebScraperNode.svelte`**:

```svelte
<script lang="ts">
  import BaseNode from './BaseNode.svelte';
  let { data, selected } = $props();
</script>
<BaseNode {data} {selected} accentColor="#3b82f6" icon="🌐" />
```

**`LocalFileReaderNode.svelte`**:

```svelte
<script lang="ts">
  import BaseNode from './BaseNode.svelte';
  let { data, selected } = $props();
</script>
<BaseNode {data} {selected} accentColor="#f59e0b" icon="📁" />
```

**`AgentNode.svelte`**:

```svelte
<script lang="ts">
  import BaseNode from './BaseNode.svelte';
  let { data, selected } = $props();
</script>
<BaseNode {data} {selected} accentColor="#8b5cf6" icon="🤖" />
```

---

### 4.4. `NodeConfigPanel.svelte`

Panel bên phải hiện khi click vào node để chỉnh sửa các trường `with`:

```svelte
<!-- src/lib/components/flow-canvas/NodeConfigPanel.svelte -->
<script lang="ts">
  import type { Node } from '@xyflow/svelte';

  let {
    node,
    onUpdate,
    onClose,
  } = $props<{
    node: Node | null;
    onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
    onClose: () => void;
  }>();

  let configText = $state('');

  $effect(() => {
    if (node) {
      configText = JSON.stringify(node.data.config ?? {}, null, 2);
    }
  });

  function applyConfig() {
    if (!node) return;
    try {
      const parsed = JSON.parse(configText);
      onUpdate(node.id, parsed);
    } catch {
      // TODO: hiện validation error
    }
  }
</script>

{#if node}
  <aside class="config-panel">
    <div class="config-header">
      <h3>{node.data.label}</h3>
      <button onclick={onClose} aria-label="Close">✕</button>
    </div>
    <div class="config-body">
      <label>
        <span>Step ID</span>
        <input value={node.id} disabled />
      </label>
      <label>
        <span>Type</span>
        <input value={node.data.stepType} disabled />
      </label>
      <label>
        <span>Config (JSON)</span>
        <textarea bind:value={configText} rows={8} spellcheck="false"></textarea>
      </label>
      <button class="primary-button" onclick={applyConfig}>Apply</button>
    </div>
  </aside>
{/if}

<style>
  .config-panel {
    width: 280px;
    background: #1e1e2e;
    border-left: 1px solid #3b3b5c;
    display: flex;
    flex-direction: column;
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    z-index: 10;
  }
  .config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #3b3b5c;
  }
  .config-header h3 { margin: 0; font-size: 14px; }
  .config-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  textarea { font-family: monospace; font-size: 12px; resize: vertical; }
</style>
```

---

### 4.5. `NodePalette.svelte`

Thanh sidebar trái để kéo node vào canvas:

```svelte
<!-- src/lib/components/flow-canvas/NodePalette.svelte -->
<script lang="ts">
  const NODE_TYPES = [
    { type: 'manual_trigger', label: 'Manual Trigger', icon: '▶', color: '#10b981' },
    { type: 'web_scraper',    label: 'Web Scraper',    icon: '🌐', color: '#3b82f6' },
    { type: 'local_file_reader', label: 'File Reader', icon: '📁', color: '#f59e0b' },
    { type: 'agent',          label: 'AI Agent',       icon: '🤖', color: '#8b5cf6' },
  ];

  function onDragStart(event: DragEvent, nodeType: string) {
    event.dataTransfer?.setData('application/symflow-node-type', nodeType);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
</script>

<nav class="palette">
  <h4>Nodes</h4>
  {#each NODE_TYPES as nt}
    <div
      class="palette-item"
      draggable="true"
      ondragstart={(e) => onDragStart(e, nt.type)}
      style="--color: {nt.color}"
      role="button"
      tabindex="0"
    >
      <span>{nt.icon}</span>
      <span>{nt.label}</span>
    </div>
  {/each}
</nav>

<style>
  .palette {
    width: 160px;
    background: #181825;
    border-right: 1px solid #3b3b5c;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h4 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; color: #6c7086; }
  .palette-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--color);
    cursor: grab;
    font-size: 13px;
    color: #cdd6f4;
    background: transparent;
    transition: background 0.15s;
  }
  .palette-item:hover { background: color-mix(in srgb, var(--color) 15%, transparent); }
</style>
```

---

### 4.6. `FlowCanvas.svelte` (Component chính)

```svelte
<!-- src/lib/components/flow-canvas/FlowCanvas.svelte -->
<script lang="ts">
  import { writable } from 'svelte/store';
  import {
    SvelteFlow,
    Controls,
    Background,
    BackgroundVariant,
    MiniMap,
    type Node,
    type Edge,
    type NodeTypes,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import { dslToGraph, graphToDsl, type DslFlow } from '$lib/utils/flow-graph';
  import NodePalette from './NodePalette.svelte';
  import NodeConfigPanel from './NodeConfigPanel.svelte';
  import ManualTriggerNode from './nodes/ManualTriggerNode.svelte';
  import WebScraperNode from './nodes/WebScraperNode.svelte';
  import LocalFileReaderNode from './nodes/LocalFileReaderNode.svelte';
  import AgentNode from './nodes/AgentNode.svelte';

  let {
    dsl,
    flowId,
    flowName,
    onDslChange,
  } = $props<{
    dsl: DslFlow;
    flowId: string;
    flowName: string;
    onDslChange: (newDsl: DslFlow) => void;
  }>();

  // Đăng ký custom node types
  const nodeTypes: NodeTypes = {
    manualTrigger: ManualTriggerNode,
    webScraper: WebScraperNode,
    localFileReader: LocalFileReaderNode,
    agentNode: AgentNode,
  };

  const { nodes: initNodes, edges: initEdges } = dslToGraph(dsl);
  const nodes = writable<Node[]>(initNodes);
  const edges = writable<Edge[]>(initEdges);

  let selectedNode = $state<Node | null>(null);

  // Phát ra DSL mới mỗi khi graph thay đổi
  function emitDsl() {
    onDslChange(graphToDsl(flowId, flowName, $nodes, $edges));
  }

  // Xử lý kéo thả node từ palette vào canvas
  function onDrop(event: DragEvent) {
    event.preventDefault();
    const stepType = event.dataTransfer?.getData('application/symflow-node-type');
    if (!stepType) return;

    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = { x: event.clientX - bounds.left - 80, y: event.clientY - bounds.top - 20 };
    const id = `${stepType}_${Date.now()}`;

    nodes.update((ns) => [
      ...ns,
      {
        id,
        type: mapType(stepType),
        position,
        data: { label: id, stepType, config: {} },
      },
    ]);
    emitDsl();
  }

  function mapType(t: string) {
    const m: Record<string, string> = {
      manual_trigger: 'manualTrigger',
      web_scraper: 'webScraper',
      local_file_reader: 'localFileReader',
    };
    return m[t] ?? 'agentNode';
  }

  function onNodeClick(_event: MouseEvent, node: Node) {
    selectedNode = node;
  }

  function handleConfigUpdate(nodeId: string, config: Record<string, unknown>) {
    nodes.update((ns) =>
      ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config } } : n))
    );
    emitDsl();
  }
</script>

<div
  class="canvas-wrapper"
  ondrop={onDrop}
  ondragover={(e) => e.preventDefault()}
  role="region"
  aria-label="Flow canvas"
>
  <NodePalette />

  <div class="flow-area">
    <SvelteFlow
      {nodes}
      {edges}
      {nodeTypes}
      fitView
      on:nodeclick={({ detail: { event, node } }) => onNodeClick(event, node)}
      on:nodedragstop={emitDsl}
      on:edgecreate={emitDsl}
      on:edgedelete={emitDsl}
      on:nodedelete={emitDsl}
    >
      <Background variant={BackgroundVariant.Dots} />
      <Controls />
      <MiniMap />
    </SvelteFlow>
  </div>

  <NodeConfigPanel
    node={selectedNode}
    onUpdate={handleConfigUpdate}
    onClose={() => (selectedNode = null)}
  />
</div>

<style>
  .canvas-wrapper {
    display: flex;
    height: 100%;
    position: relative;
    background: #11111b;
  }
  .flow-area {
    flex: 1;
    position: relative;
  }
</style>
```

---

## 5. Tích hợp vào `shared-editor.svelte`

Thay thế `<DslEditor>` bằng `<FlowCanvas>` trong `src/routes/flows/shared-editor.svelte`.

**Các thay đổi cần làm:**

1. Import `FlowCanvas` thay vì `DslEditor`.
2. Parse `dslScript` (string JSON) thành object `DslFlow` để truyền vào canvas.
3. Nhận callback `onDslChange` từ canvas, serialize ngược lại thành JSON string để gửi API.
4. Giữ nguyên `handleSave` và `handleRun` – chúng vẫn dùng `dslScript` string như cũ.

**Đoạn diff chính** trong `shared-editor.svelte`:

```diff
- import DslEditor from '$lib/components/DslEditor.svelte';
+ import FlowCanvas from '$lib/components/flow-canvas/FlowCanvas.svelte';
+ import { parseJsonDsl } from '$lib/utils/dsl';
+ import type { DslFlow } from '$lib/utils/flow-graph';
```

```diff
- <DslEditor bind:value={dslScript} disabled={isSaving || isRunning} />
+ <div class="canvas-container">
+   <FlowCanvas
+     dsl={parseJsonDsl(dslScript) as DslFlow}
+     flowId={flowId || 'new-flow'}
+     flowName={name || 'New Flow'}
+     onDslChange={(newDsl) => { dslScript = JSON.stringify(newDsl, null, 2); }}
+   />
+ </div>
```

```css
/* Thêm vào style section */
.canvas-container {
  height: 520px;
  border: 1px solid #3b3b5c;
  border-radius: 8px;
  overflow: hidden;
}
```

---

## 6. Các Edge Cases & Lưu ý

| Tình huống | Xử lý |
|---|---|
| DSL có `depends_on` rõ ràng | `dslToGraph` dùng chúng để tạo edges thay vì suy ra tuần tự |
| Người dùng tạo cycle trên canvas | `topoSort` fallback về thứ tự gốc, không crash |
| DSL JSON không hợp lệ khi mở trang | `parseJsonDsl` throw → `shared-editor` catch và hiện error message |
| Node bị xóa có edges đính kèm | Svelte Flow tự xóa edges liên quan khi node bị xóa |
| `flowId` chưa có (flow mới) | Truyền `'new-flow'` tạm, API tạo ID thật khi save lần đầu |
| Nhiều step cùng `depends_on` một step | Tạo nhiều edges từ 1 source, vẫn render đúng |

---

## 7. Kiểm thử (Testing)

Sau khi implement, chạy:

```bash
# Unit tests
npm run test

# Type check
npm run check
```

**Test thủ công cần thực hiện:**

- [ ] Load flow có sẵn → canvas hiển thị đúng nodes và edges từ DSL
- [ ] Kéo node từ palette vào canvas → node xuất hiện
- [ ] Nối 2 nodes → edge được tạo → Save → API nhận DSL với thứ tự đúng
- [ ] Click node → config panel mở → chỉnh sửa → Apply → Save → DSL cập nhật
- [ ] Xóa node → edges liên quan tự mất
- [ ] Flow mới (không có DSL) → canvas hiển thị empty state

---

## 8. Thứ tự thực thi (Implementation Order)

1. `npm install @xyflow/svelte`
2. Tạo `src/lib/utils/flow-graph.ts`
3. Tạo các file trong `src/lib/components/flow-canvas/nodes/`
4. Tạo `NodeConfigPanel.svelte`
5. Tạo `NodePalette.svelte`
6. Tạo `FlowCanvas.svelte`
7. Sửa `src/routes/flows/shared-editor.svelte` để tích hợp `FlowCanvas`
8. Chạy `npm run check` và fix type errors
9. Chạy `npm run test` để đảm bảo không có regression

---

## 9. Không thay đổi

Các phần sau **không được sửa** trong lần nâng cấp này:

- `src/lib/api/` – API client giữ nguyên hoàn toàn
- `src/lib/types/symflow.ts` – Types không thay đổi
- `FlowUpsertPayload.dsl_script` vẫn là `string` JSON
- Routes `+page.ts` và `+layout.ts`
- `DslEditor.svelte` có thể giữ lại làm fallback (không xóa)

---

*Tài liệu này đủ để một agent AI thực thi toàn bộ nâng cấp mà không cần hỏi thêm thông tin.*
