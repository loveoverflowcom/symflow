import { i as onDestroy } from "./internal2.js";
import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, n as attr_style, o as head, r as bind_props, t as attr_class } from "./server.js";
import "./client.js";
import { n as t, t as language } from "./i18n.js";
import { t as AppShell } from "./AppShell.js";
import "./JsonBlock.js";
import "esbuild-wasm";
import "ts-morph";
//#region ../../packages/symflow-runtime/src/registry.ts
var TaskRegistry = class {
	entries = /* @__PURE__ */ new Map();
	register(meta, fn) {
		this.entries.set(meta.name, {
			meta,
			fn
		});
	}
	get(name) {
		const entry = this.entries.get(name);
		if (!entry) throw new Error(`Task not found: "${name}"`);
		return entry.fn;
	}
	list() {
		return Array.from(this.entries.values(), ({ meta }) => meta);
	}
	clear() {
		this.entries.clear();
	}
};
new TaskRegistry();
function schemaToType(schema) {
	if (!schema || typeof schema !== "object") return "unknown";
	const value = schema;
	if (Array.isArray(value.enum)) return value.enum.map((entry) => JSON.stringify(entry)).join(" | ") || "never";
	if (Array.isArray(value.anyOf)) return value.anyOf.map(schemaToType).join(" | ");
	if (Array.isArray(value.oneOf)) return value.oneOf.map(schemaToType).join(" | ");
	const type = value.type;
	if (Array.isArray(type)) return type.map((entry) => schemaToType({
		...value,
		type: entry
	})).join(" | ");
	if (type === "string") return "string";
	if (type === "number" || type === "integer") return "number";
	if (type === "boolean") return "boolean";
	if (type === "null") return "null";
	if (type === "array") return `Array<${schemaToType(value.items)}>`;
	if (type === "object" || value.properties) {
		const properties = value.properties && typeof value.properties === "object" ? value.properties : {};
		const required = new Set(Array.isArray(value.required) ? value.required : []);
		const fields = Object.entries(properties).map(([key, property]) => {
			const propertySchema = property;
			return `${typeof propertySchema?.description === "string" ? `/** ${escapeDoc(propertySchema.description)} */ ` : ""}${propertyName(key)}${required.has(key) ? "" : "?"}: ${schemaToType(property)};`;
		});
		const additional = value.additionalProperties && value.additionalProperties !== false ? `[key: string]: ${value.additionalProperties === true ? "unknown" : schemaToType(value.additionalProperties)};` : "";
		return `{ ${[...fields, additional].filter(Boolean).join(" ")} }`;
	}
	return "unknown";
}
function propertyName(value) {
	return /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
}
function escapeDoc(value) {
	return value.replace(/\*\//g, "*\\/").replace(/\s+/g, " ").trim();
}
//#endregion
//#region src/lib/components/WorkflowEditor.svelte
function WorkflowEditor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { value = "", disabled = false, declarations = "", modelUri = "file:///workflow.ts", height = 540, onErrorCountChange } = $$props;
		let diagnostics = [];
		const errorCount = derived(() => diagnostics.filter((marker) => marker.severity === void 0).length);
		const warningCount = derived(() => diagnostics.filter((marker) => marker.severity === void 0).length);
		function flattenDiagnosticMessage(message) {
			if (typeof message === "string") return message;
			const children = Array.isArray(message.next) ? message.next.map((child) => flattenDiagnosticMessage(child)) : [];
			return [message.messageText, ...children].filter(Boolean).join("\n");
		}
		function severityLabel(severity) {
			if (severity === void 0) return "Error";
			if (severity === void 0) return "Warning";
			return "Info";
		}
		onDestroy(() => {});
		$$renderer.push(`<div class="workflow-editor svelte-1oj5zx8"${attr_style("", { height: `${height}px` })}></div> <section class="problems-panel svelte-1oj5zx8" aria-live="polite"><header class="svelte-1oj5zx8"><div class="svelte-1oj5zx8"><strong>Problems</strong> `);
		if (errorCount() > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="count error-count svelte-1oj5zx8">${escape_html(errorCount())} errors</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (warningCount() > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="count warning-count svelte-1oj5zx8">${escape_html(warningCount())} warnings</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<span class="checking svelte-1oj5zx8">Checking TypeScript…</span>`);
		$$renderer.push(`<!--]--></header> `);
		if (diagnostics.length > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="problem-list svelte-1oj5zx8"><!--[-->`);
			const each_array = ensure_array_like(diagnostics);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let marker = each_array[$$index];
				$$renderer.push(`<button type="button"${attr_class("svelte-1oj5zx8", void 0, {
					"error": marker.severity === void 0,
					"warning": marker.severity === void 0
				})}><span class="problem-icon svelte-1oj5zx8">${escape_html(marker.severity === void 0 ? "×" : "!")}</span> <span class="problem-message svelte-1oj5zx8">${escape_html(marker.message)}</span> <code class="svelte-1oj5zx8">Ln ${escape_html(marker.startLineNumber)}, Col ${escape_html(marker.startColumn)}</code> <span class="sr-only svelte-1oj5zx8">${escape_html(severityLabel(marker.severity))}</span></button>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section>`);
		bind_props($$props, { value });
	});
}
//#endregion
//#region src/lib/utils/workflow.ts
var DEFAULT_RUN_INPUT_SOURCE = `import type { main } from './workflow';

type WorkflowInput = Parameters<typeof main>[0];

const input: WorkflowInput = {
  url: 'https://example.com'
};

export default input;
`;
//#endregion
//#region src/routes/flows/shared-editor.svelte
function Shared_editor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { flow } = $$props;
		let name = "";
		let runInputSource = DEFAULT_RUN_INPUT_SOURCE;
		let isRunning = false;
		let tasks = [];
		const pageTitle = derived(() => flow ? t(store_get($$store_subs ??= {}, "$language", language), "editFlow") : t(store_get($$store_subs ??= {}, "$language", language), "newFlow"));
		const runDisabled = derived(() => true);
		function serializeInputForPersistence(input) {
			if (isFileLike(input)) {
				const isFile = typeof File !== "undefined" && input instanceof File;
				return {
					__type: isFile ? "File" : "Blob",
					name: isFile ? input.name : void 0,
					size: input.size,
					type: input.type
				};
			}
			if (Array.isArray(input)) return input.map(serializeInputForPersistence);
			if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, serializeInputForPersistence(value)]));
			return input;
		}
		function isFileLike(value) {
			return typeof Blob !== "undefined" && value instanceof Blob;
		}
		function plainWorkflowInput(input) {
			if (isFileLike(input)) return input;
			if (Array.isArray(input)) return input.map(plainWorkflowInput);
			if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== void 0).map(([key, value]) => [key, plainWorkflowInput(value)]));
			return input;
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			head("mh9iut", $$renderer, ($$renderer) => {
				$$renderer.title(($$renderer) => {
					$$renderer.push(`<title>${escape_html(pageTitle())} | ${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "appName"))}</title>`);
				});
			});
			{
				function actions($$renderer) {
					$$renderer.push(`<a class="secondary-button" href="/flows">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "backToFlows"))}</a>`);
				}
				AppShell($$renderer, {
					actions,
					children: ($$renderer) => {
						$$renderer.push(`<div class="flow-editor-page"><div class="page-title-block"><h1>${escape_html(pageTitle())}</h1> <p class="subtitle">TypeScript chạy trong browser; backend chỉ cung cấp task và lưu kết quả.</p></div> <section class="flow-editor-stack"><header class="editor-topbar card"><label class="flow-name-field stack-sm"><span>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "name"))}</span> <input${attr("value", name)} placeholder="article-summary"/></label> <button class="primary-button" type="button"${attr("disabled", true, true)}>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "saveFlow"))}</button></header> <div class="tabs editor-tabs svelte-mh9iut" role="tablist" aria-label="Workflow sections"><button type="button" role="tab"${attr("aria-selected", true)}${attr_class("", void 0, { "active": true })}>Workflow</button> <button type="button" role="tab"${attr("aria-selected", false)}${attr_class("", void 0, { "active": false })}>Tasks <span class="tab-count svelte-mh9iut">${escape_html(tasks.length)}</span></button></div> `);
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<section class="card stack-sm"><h2>TypeScript workflow</h2> `);
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></section> <section class="editor-run card stack"><div class="stack-sm"><h2>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runInputsSection"))}</h2> <p class="muted">Kiểu dữ liệu được lấy trực tiếp từ <code>main(input)</code>. Dùng form nhanh, hoặc chuyển sang TypeScript khi cần.</p></div> `);
						$$renderer.push("<!--[-1-->");
						WorkflowEditor($$renderer, {
							modelUri: "file:///run-input.ts",
							height: 300,
							disabled: isRunning,
							onErrorCountChange: (count) => count,
							get value() {
								return runInputSource;
							},
							set value($$value) {
								runInputSource = $$value;
								$$settled = false;
							}
						});
						$$renderer.push(`<!----> `);
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]-->`);
						$$renderer.push(`<!--]--> <button class="primary-button" type="button"${attr("disabled", runDisabled(), true)}>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runFlow"))}</button></section>`);
						$$renderer.push(`<!--]--> `);
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></section></div>`);
					},
					$$slots: {
						actions: true,
						default: true
					}
				});
			}
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { Shared_editor as t };
