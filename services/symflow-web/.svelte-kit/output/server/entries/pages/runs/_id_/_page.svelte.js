import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, o as head, t as attr_class } from "../../../../chunks/server.js";
import { s as formatDate } from "../../../../chunks/client.js";
import { n as t, t as language } from "../../../../chunks/i18n.js";
import { t as AppShell } from "../../../../chunks/AppShell.js";
import { t as InlineError } from "../../../../chunks/InlineError.js";
import { t as JsonBlock } from "../../../../chunks/JsonBlock.js";
//#region src/lib/utils/artifacts.ts
function collectDownloadArtifacts(value) {
	const artifacts = [];
	const seen = /* @__PURE__ */ new Set();
	walk(value, "output");
	return artifacts;
	function walk(current, path) {
		if (!current || typeof current !== "object") return;
		if (Array.isArray(current)) {
			current.forEach((item, index) => walk(item, `${path}[${index}]`));
			return;
		}
		const record = current;
		const filename = typeof record.filename === "string" ? record.filename.trim() : "";
		if (typeof record.csv === "string" && record.csv.trim()) pushArtifact({
			kind: "csv",
			filename: normalizeFilename(filename, path, "csv"),
			csv: record.csv
		});
		if (typeof record.content_base64 === "string" && record.content_base64.trim()) pushArtifact({
			kind: "pdf",
			filename: normalizeFilename(filename, path, "pdf"),
			contentBase64: record.content_base64
		});
		for (const [key, child] of Object.entries(record)) walk(child, `${path}.${key}`);
	}
	function pushArtifact(artifact) {
		const key = artifact.kind === "csv" ? `csv:${artifact.filename}:${artifact.csv}` : `pdf:${artifact.filename}:${artifact.contentBase64}`;
		if (seen.has(key)) return;
		seen.add(key);
		artifacts.push(artifact);
	}
}
function normalizeFilename(filename, path, extension) {
	if (filename) return filename;
	const segments = path.split(/[\.\[\]]+/).filter(Boolean);
	return `${segments[segments.length - 1] || "output"}.${extension}`;
}
//#endregion
//#region src/lib/components/DownloadArtifacts.svelte
function DownloadArtifacts($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { value } = $$props;
		const artifacts = derived(() => collectDownloadArtifacts(value));
		if (artifacts().length > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="download-artifacts svelte-1jjihb7"><!--[-->`);
			const each_array = ensure_array_like(artifacts());
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let artifact = each_array[$$index];
				if (artifact.kind === "csv") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<button class="secondary-button" type="button">Tải CSV: ${escape_html(artifact.filename)}</button>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<button class="secondary-button" type="button">Tải PDF: ${escape_html(artifact.filename)}</button>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/StatusBadge.svelte
function StatusBadge($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { value } = $$props;
		const toneByStatus = {
			PENDING: "pending",
			RUNNING: "running",
			SUCCESS: "gumloop",
			COMPLETED: "gumloop",
			FAILED: "failed",
			SKIPPED: "muted"
		};
		const tone = derived(() => toneByStatus[value] ?? "muted");
		$$renderer.push(`<span${attr_class(`badge ${tone()}`)}>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), `status_${value}`))}</span>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/routes/runs/[id]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { data } = $$props;
		head("1eidjaf", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runTitle", { id: data.run?.id ?? data.runId }))} | ${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "appName"))}</title>`);
			});
		});
		{
			function actions($$renderer) {
				$$renderer.push(`<a class="secondary-button"${attr("href", data.run ? `/flows/${data.run.flow_id}` : "/flows")}>${escape_html(data.run ? t(store_get($$store_subs ??= {}, "$language", language), "backToFlow") : t(store_get($$store_subs ??= {}, "$language", language), "backToFlows"))}</a>`);
			}
			AppShell($$renderer, {
				actions,
				children: ($$renderer) => {
					if (data.error) {
						$$renderer.push("<!--[0-->");
						InlineError($$renderer, {
							error: {
								...data.error,
								title: t(store_get($$store_subs ??= {}, "$language", language), "unableLoadRun", { id: data.runId })
							},
							retryHref: "/flows"
						});
					} else if (data.run) {
						$$renderer.push("<!--[1-->");
						$$renderer.push(`<div class="page-title-block"><h1>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runTitle", { id: data.run.id }))}</h1> <p class="subtitle">Kết quả và task log được ghi từ TypeScript runtime trong browser.</p></div> <section class="run-overview"><article class="card stack"><div class="row-between"><h2>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runStatus"))}</h2> `);
						StatusBadge($$renderer, { value: data.run.status });
						$$renderer.push(`<!----></div> <p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "flow"))}:</strong> <span class="mono">${escape_html(data.run.flow_id)}</span></p> <p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "started"))}:</strong> ${escape_html(formatDate(data.run.created_at))}</p> <p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "finished"))}:</strong> ${escape_html(formatDate(data.run.finished_at))}</p> `);
						if (data.run.error) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<p class="error-message">${escape_html(data.run.error)}</p>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						JsonBlock($$renderer, {
							label: t(store_get($$store_subs ??= {}, "$language", language), "initialInputs"),
							value: data.run.initial_inputs
						});
						$$renderer.push(`<!----> `);
						JsonBlock($$renderer, {
							label: "Output",
							value: data.run.output
						});
						$$renderer.push(`<!----> `);
						DownloadArtifacts($$renderer, { value: data.run.output });
						$$renderer.push(`<!----></article> <article class="card stack"><h2>Execution log</h2> `);
						if (!data.run.execution_logs?.length) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<p class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "noLogEvents"))}</p>`);
						} else {
							$$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--[-->`);
							const each_array = ensure_array_like(data.run.execution_logs);
							for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
								let log = each_array[$$index];
								$$renderer.push(`<section class="step-card"><div class="row-between"><strong>${escape_html(log.name ?? log.type)}</strong> <span class="muted">${escape_html(new Date(log.timestamp).toLocaleTimeString())}</span></div> `);
								if (log.error) {
									$$renderer.push("<!--[0-->");
									$$renderer.push(`<p class="error-message">${escape_html(log.error)}</p>`);
								} else $$renderer.push("<!--[-1-->");
								$$renderer.push(`<!--]--> `);
								if (log.input !== void 0) {
									$$renderer.push("<!--[0-->");
									JsonBlock($$renderer, {
										label: "Input",
										value: log.input
									});
								} else $$renderer.push("<!--[-1-->");
								$$renderer.push(`<!--]--> `);
								if (log.output !== void 0) {
									$$renderer.push("<!--[0-->");
									JsonBlock($$renderer, {
										label: "Output",
										value: log.output
									});
								} else $$renderer.push("<!--[-1-->");
								$$renderer.push(`<!--]--> `);
								if (log.output !== void 0) {
									$$renderer.push("<!--[0-->");
									DownloadArtifacts($$renderer, { value: log.output });
								} else $$renderer.push("<!--[-1-->");
								$$renderer.push(`<!--]--></section>`);
							}
							$$renderer.push(`<!--]-->`);
						}
						$$renderer.push(`<!--]--></article></section>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				},
				$$slots: {
					actions: true,
					default: true
				}
			});
		}
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
