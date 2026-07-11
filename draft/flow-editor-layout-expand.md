# Guide: Expand Flow Editor Layout & Move Run Inputs Below Script

> Restructure the workflow editor in **symflow-web** so the canvas/script area uses most of the viewport, and the **run inputs** panel sits **below** the script section (not in a right sidebar).
>
> Primary file: `services/symflow-web/src/routes/flows/shared-editor.svelte`

---

## Problem (current state)

The flow editor feels cramped because of stacked constraints:

| Issue | Where | Effect |
|-------|-------|--------|
| Two-column layout | `.editor-layout` in `app.css` | Main editor gets ~66% width; run panel steals ~34% on the right |
| Fixed canvas height | `.canvas-container` in `shared-editor.svelte` | Canvas locked to **540px** regardless of screen size |
| Hidden JSON script | `shared-editor.svelte` | When DSL is valid, only `FlowCanvas` renders — raw JSON is not visible |
| Inner canvas chrome | `NodePalette` (176px) + `NodeConfigPanel` (290px overlay) | Further reduces usable canvas width |
| Page padding | `.page-content`, `.content-header` in `app.css` | Large horizontal padding (`clamp(30px, 5vw, 78px)`) and tall header (112px min) |
| Global textarea default | `textarea { min-height: 320px }` in `app.css` | Script areas compete for space awkwardly |

Current DOM structure:

```
editor-layout (2 columns)
├── article.card          ← name, canvas/script, save
└── aside.card            ← run inputs + run button  ❌ should move below
```

---

## Target layout

Single full-width column. **Script first, inputs second.**

```
flow-editor-page
├── editor-topbar          name + save (compact)
├── editor-primary         expanded canvas (full width)
├── editor-script          JSON DSL panel (always visible when editing)
├── editor-run             run inputs + run button
└── editor-footer-hint     keyboard / validation hints
```

### Visual order (top → bottom)

1. **Flow name** + **Save** (one row)
2. **Visual canvas** (primary, viewport-driven height)
3. **JSON script** (`DslEditor`) — below canvas, resizable
4. **Run inputs** — below script (moved from right `aside`)
5. **Run flow** button in the run section

When JSON is invalid, show the invalid notice + `DslEditor` in the script slot; hide or dim the canvas.

---

## Implementation tasks

### Phase 1 — Restructure `shared-editor.svelte` markup

**File:** `services/symflow-web/src/routes/flows/shared-editor.svelte`

- [ ] **1.1** Replace `<section class="editor-layout">` with `<section class="flow-editor-stack">`.
- [ ] **1.2** Remove the right `<aside class="card stack">` run panel.
- [ ] **1.3** Split the main `<article>` into explicit sections:

```svelte
<section class="flow-editor-stack">
  <header class="editor-topbar card">
    <label class="flow-name-field">...</label>
    <div class="button-row">
      <button class="primary-button" ...>Save</button>
    </div>
  </header>

  <section class="editor-primary card">
    {#if initialized && parsedDsl}
      <div class="canvas-container">
        <FlowCanvas ... />
      </div>
    {:else if initialized}
      <div class="invalid-dsl-notice">...</div>
    {/if}
  </section>

  <section class="editor-script card">
    <DslEditor bind:value={dslScript} disabled={isSaving || isRunning} />
  </section>

  <section class="editor-run card stack">
    <div class="stack-sm">
      <h2>{t($language, 'runFlow')}</h2>
      <p class="muted">{t($language, 'runFlowDescription')}</p>
    </div>
    <label class="stack-sm">
      <span>{t($language, 'inputs')}</span>
      <textarea bind:value={runInputsText} class="run-inputs-editor" spellcheck="false" />
    </label>
    <button class="primary-button" ...>Run</button>
  </section>

  {#if errorMessage}
    <p class="error-message">{errorMessage}</p>
  {/if}

  <p class="canvas-hint muted">...</p>
</section>
```

- [ ] **1.4** **Always show `DslEditor`** when editing (not only on invalid DSL). Canvas and script stay in sync via existing `onDslChange` → `dslScript` binding.
- [ ] **1.5** Optional: add `editorView` toggle (`canvas` | `script` | `both`) — default **`both`** for v1; defer toggle to v2 if time is short.

#### Sync behavior (keep existing logic)

- Canvas → script: `onDslChange` sets `dslScript = JSON.stringify(newDsl, null, 2)`
- Script → canvas: `parsedDsl` derived from `dslScript`; canvas remounts when JSON becomes valid
- On save: `formatJsonDsl(dslScript)` before API call (unchanged)

---

### Phase 2 — CSS: full-width stack + expanded heights

#### 2.1 Replace two-column grid globally

**File:** `services/symflow-web/src/app.css`

- [ ] Change `.editor-layout` to a single-column stack (or add new class and stop using `.editor-layout` on flow pages):

```css
.flow-editor-stack {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}
```

- [ ] Leave `.editor-layout` as-is for any other pages, or migrate them and delete the 2-column rule:

```css
/* OLD — remove from flow editor usage */
.editor-layout {
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
}
```

#### 2.2 Viewport-based canvas height

**File:** `shared-editor.svelte` `<style>` (or `app.css` if shared)

Replace fixed `540px`:

```css
.canvas-container {
  /* Primary editing surface — grow with viewport */
  height: clamp(420px, calc(100vh - 28rem), 820px);
  min-height: 420px;
  overflow: hidden;
  border: 1px solid var(--border-input);
  border-radius: 12px;
  background: #f8f9fa;
}
```

Tune the `28rem` offset after measuring:
- sidebar + topbar + script panel + run panel + padding ≈ `22rem–32rem`

Alternative (flex-based, preferred for “fill remaining space”):

```css
.flow-editor-page .page-content {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 112px); /* minus content-header */
}

.flow-editor-stack {
  flex: 1;
  min-height: 0;
}

.editor-primary {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.canvas-container {
  flex: 1;
  min-height: 360px;
}
```

- [ ] **2.3** Ensure `FlowCanvasViewport` `.canvas-wrapper { height: 100% }` propagates — already set; parent chain must have explicit height (tasks above).

#### 2.3 Script panel sizing

**File:** `app.css` or component styles

```css
.editor-script .dsl-editor {
  min-height: 220px;
  max-height: 320px;
  resize: vertical;
}

.run-inputs-editor {
  min-height: 140px;
  max-height: 240px;
  resize: vertical;
  font-family: "JetBrains Mono", ui-monospace, monospace;
}
```

Remove use of `.dsl-editor.compact` for run inputs — use dedicated `.run-inputs-editor` so script and run areas have independent sizes.

#### 2.4 Compact top bar

```css
.editor-topbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.flow-name-field {
  flex: 1;
  min-width: 0;
}
```

Move **Save** to top bar; keep **Run** only in the run section below inputs.

#### 2.5 Reduce padding on flow editor routes (optional but recommended)

Add a page wrapper class in `shared-editor.svelte`:

```svelte
<AppShell>
  <div class="flow-editor-page">
    ...
  </div>
</AppShell>
```

```css
.flow-editor-page .page-title-block {
  margin-bottom: 1rem;
}

/* If AppShell exposes a hook, or use :global from page */
:global(.flow-editor-page) ~ * { /* not ideal */ }

/* Better: pass class to AppShell via prop snippet, or use route layout */
```

**Simpler approach:** add `services/symflow-web/src/routes/flows/+layout.svelte`:

```svelte
<div class="flow-route-layout">
  <slot />
</div>

<style>
  :global(.flow-route-layout) { /* target parent page-content via wrapper */ }
</style>
```

Or reduce padding directly in `shared-editor.svelte`:

```css
:global(.page-content:has(.flow-editor-stack)) {
  padding-top: 1rem;
  padding-bottom: 2rem;
}
```

- [ ] **2.6** Shrink `content-header` on flow pages — e.g. `min-height: 64px` when `.flow-editor-page` is present.

---

### Phase 3 — Canvas internal layout (optional polish)

The canvas still loses width to `NodePalette` (176px). Consider:

| Option | Effort | Benefit |
|--------|--------|---------|
| Collapsible palette | Medium | More horizontal canvas space |
| Palette as horizontal toolbar above canvas | Medium | Better on wide screens |
| Hide palette on `< 900px`, keep “+” menu | Low | Mobile improvement |

**Not required for v1** unless canvas still feels narrow after full-width stack.

`NodeConfigPanel` (290px right overlay) is acceptable — it appears only when a node is selected.

---

### Phase 4 — i18n & copy

**File:** `services/symflow-web/src/lib/i18n.ts`

- [ ] Add keys if introducing a script section label:
  - `jsonScriptSection`: "Flow script (JSON)"
  - `runInputsSection`: "Run inputs"
- [ ] Update `editorSubtitle` to mention canvas + script + run order if needed.

---

### Phase 5 — Responsive behavior

**File:** `app.css` `@media` blocks

Current rule at `max-width: 980px` already stacks `.editor-layout` to one column — after migration, behavior should be consistent by default.

- [ ] At `max-width: 720px`, reduce canvas `min-height` to `300px`.
- [ ] Stack topbar vertically: name full width, save button full width.
- [ ] `NodePalette` already shrinks to 132px at `760px` — verify touch targets.

---

## File checklist

| File | Action |
|------|--------|
| `src/routes/flows/shared-editor.svelte` | Restructure DOM; move run panel; always show `DslEditor` |
| `src/app.css` | Add `.flow-editor-stack`, `.run-inputs-editor`; adjust `.editor-layout` usage |
| `src/lib/components/DslEditor.svelte` | No logic change; may add optional `compact` prop |
| `src/lib/components/flow-canvas/FlowCanvasViewport.svelte` | Verify `height: 100%` chain |
| `src/lib/i18n.ts` | Section labels (optional) |
| `src/routes/flows/+layout.svelte` | Optional route-scoped padding (new file) |

---

## Before / after ASCII

### Before

```
┌─────────────────────────────────────────────────────────────┐
│ Title + subtitle                                            │
├──────────────────────────────┬──────────────────────────────┤
│ Name                         │ Run flow                     │
│ ┌──────────────────────────┐ │ Inputs (compact)             │
│ │ Canvas (540px fixed)     │ │ [ Run ]                      │
│ └──────────────────────────┘ │                              │
│ [ Save ]                     │                              │
└──────────────────────────────┴──────────────────────────────┘
        ~66% width                    ~34% width
```

### After

```
┌─────────────────────────────────────────────────────────────┐
│ Title + subtitle (optional / compact)                       │
├─────────────────────────────────────────────────────────────┤
│ Name                                    [ Save ]            │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Canvas (clamp / calc(100vh - …))                        │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ JSON script (DslEditor, resizable)                          │
├─────────────────────────────────────────────────────────────┤
│ Run inputs (textarea)                                       │
│ [ Run flow ]                                                │
└─────────────────────────────────────────────────────────────┘
                    100% content width
```

---

## Testing checklist

- [ ] `/flows/new` — canvas + script + run inputs visible in vertical order
- [ ] `/flows/[id]` — loaded DSL populates canvas and script
- [ ] Edit node on canvas → script JSON updates
- [ ] Edit script JSON → canvas updates when valid
- [ ] Invalid JSON → notice shown; canvas hidden; script editor still usable
- [ ] Save formats JSON and persists
- [ ] Run uses inputs from bottom panel; navigates to run detail
- [ ] Narrow viewport (375px) — no horizontal scroll; canvas usable
- [ ] Dark theme — borders/backgrounds on new sections
- [ ] `npm run check` passes

---

## Acceptance criteria

- [ ] Run inputs section is **below** the script section, not in a right sidebar
- [ ] Flow canvas uses **significantly more** vertical and horizontal space than the current 540px / 2-column layout
- [ ] JSON script editor is visible during normal editing (valid DSL), not only on parse errors
- [ ] Save and Run actions remain functional with unchanged API calls
- [ ] Layout works on desktop and mobile without overlapping panels

---

## Suggested PR scope

Keep one PR focused on layout only:

1. `shared-editor.svelte` markup restructure
2. CSS for stack layout + viewport heights
3. i18n label tweaks (if any)

Defer palette collapse and `canvas | script` toggle to a follow-up PR.

---

## Related files

| Path | Role |
|------|------|
| `src/routes/flows/shared-editor.svelte` | Main editor page |
| `src/routes/flows/new/+page.svelte` | Uses shared editor |
| `src/routes/flows/[id]/+page.svelte` | Uses shared editor |
| `src/app.css` | Global layout utilities |
| `src/lib/components/DslEditor.svelte` | JSON script editor |
| `src/lib/components/flow-canvas/FlowCanvasViewport.svelte` | Svelte Flow canvas |
| `src/lib/components/flow-canvas/NodePalette.svelte` | Left palette (176px) |
| `src/lib/components/flow-canvas/NodeConfigPanel.svelte` | Node config overlay |
