import "../../../../chunks/index-server.js";
import { a as head, b as attr, i as ensure_array_like, r as derived, t as attr_class, x as escape_html } from "../../../../chunks/server.js";
import { t as AppShell } from "../../../../chunks/AppShell.js";
import { n as normalizeLogEntries, r as prettyJson, t as formatDate } from "../../../../chunks/format.js";
import "../../../../chunks/client2.js";
//#region src/lib/components/JsonBlock.svelte
function JsonBlock($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { label, value } = $$props;
		$$renderer.push(`<section class="stack-sm"><h3>${escape_html(label)}</h3> `);
		if (value === void 0 || value === null || prettyJson(value) === "") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p class="muted">No data</p>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<pre>${escape_html(prettyJson(value))}</pre>`);
		}
		$$renderer.push(`<!--]--></section>`);
	});
}
//#endregion
//#region src/lib/components/ReactLogView.svelte
function ReactLogView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { runId, initialLogs = [] } = $$props;
		let logs = [];
		$$renderer.push(`<section class="stack card"><div class="row-between"><h2>ReAct log</h2> <span class="muted">${escape_html("Connecting...")}</span></div> `);
		if (logs.length === 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p class="muted">No log events yet.</p>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="stack"><!--[-->`);
			const each_array = ensure_array_like(logs);
			for (let index = 0, $$length = each_array.length; index < $$length; index++) {
				let log = each_array[index];
				$$renderer.push(`<article class="log-entry"><div class="row-between log-meta"><strong>${escape_html(log.type ?? "event")}</strong> <span class="muted">#${escape_html(index + 1)} `);
				if (log.iter !== void 0) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`· iter ${escape_html(log.iter)}`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (log.timestamp) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`· ${escape_html(formatDate(log.timestamp))}`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></span></div> `);
				if (log.stepId) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p><strong>Step:</strong> ${escape_html(log.stepId)}</p>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (log.tool) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p><strong>Tool:</strong> ${escape_html(log.tool)}</p>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (log.text) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p>${escape_html(log.text)}</p>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (log.arguments !== void 0) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<pre>${escape_html(prettyJson(log.arguments))}</pre>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></article>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></section>`);
	});
}
//#endregion
//#region src/lib/components/StatusBadge.svelte
function StatusBadge($$renderer, $$props) {
	let { value } = $$props;
	const toneByStatus = {
		PENDING: "pending",
		RUNNING: "running",
		SUCCESS: "success",
		COMPLETED: "success",
		FAILED: "failed",
		SKIPPED: "muted"
	};
	const tone = derived(() => toneByStatus[value] ?? "muted");
	$$renderer.push(`<span${attr_class(`badge ${tone()}`)}>${escape_html(value)}</span>`);
}
//#endregion
//#region src/routes/runs/[id]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		let run = {
			id: "",
			flow_id: "",
			status: "PENDING",
			created_at: "",
			steps: []
		};
		const initialLogs = derived(() => (run.steps ?? []).flatMap((step) => normalizeLogEntries(step.agent_logs)));
		head("1eidjaf", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>Run ${escape_html(run.id)} | Symflow</title>`);
			});
		});
		{
			function actions($$renderer) {
				$$renderer.push(`<a class="secondary-button"${attr("href", `/flows/${run.flow_id}`)}>Back to flow</a>`);
			}
			AppShell($$renderer, {
				title: `Run ${run.id}`,
				subtitle: "Watch step status and live ReAct logs for the current flow execution.",
				actions,
				children: ($$renderer) => {
					$$renderer.push(`<section class="run-overview"><article class="card stack"><div class="row-between"><h2>Run status</h2> `);
					StatusBadge($$renderer, { value: run.status });
					$$renderer.push(`<!----></div> <p><strong>Flow:</strong> <span class="mono">${escape_html(run.flow_id)}</span></p> <p><strong>Started:</strong> ${escape_html(formatDate(run.created_at))}</p> <p><strong>Finished:</strong> ${escape_html(formatDate(run.finished_at))}</p> `);
					JsonBlock($$renderer, {
						label: "Initial inputs",
						value: run.initial_inputs
					});
					$$renderer.push(`<!----></article> <article class="card stack"><div class="row-between"><h2>Steps</h2> <span class="muted">${escape_html(run.steps?.length ?? 0)} total</span></div> `);
					if (!run.steps || run.steps.length === 0) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<p class="muted">No step execution data yet.</p>`);
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<div class="stack"><!--[-->`);
						const each_array = ensure_array_like(run.steps);
						for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
							let step = each_array[$$index];
							$$renderer.push(`<section class="step-card"><div class="row-between"><div><h3>${escape_html(step.step_id)}</h3> <p class="muted">${escape_html(formatDate(step.executed_at))}</p></div> `);
							StatusBadge($$renderer, { value: step.status });
							$$renderer.push(`<!----></div> `);
							if (step.error) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<p class="error-message">${escape_html(step.error)}</p>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> <div class="two-column">`);
							JsonBlock($$renderer, {
								label: "Resolved inputs",
								value: step.resolved_inputs
							});
							$$renderer.push(`<!----> `);
							JsonBlock($$renderer, {
								label: "Outputs",
								value: step.outputs
							});
							$$renderer.push(`<!----></div></section>`);
						}
						$$renderer.push(`<!--]--></div>`);
					}
					$$renderer.push(`<!--]--></article></section> `);
					ReactLogView($$renderer, {
						runId: run.id,
						initialLogs: initialLogs()
					});
					$$renderer.push(`<!---->`);
				},
				$$slots: {
					actions: true,
					default: true
				}
			});
		}
	});
}
//#endregion
export { _page as default };
