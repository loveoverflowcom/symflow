import { b as attr, i as head, n as derived, o as store_get, r as ensure_array_like, s as unsubscribe_stores, t as attr_class, x as escape_html } from "../../../../chunks/server.js";
import "../../../../chunks/internal2.js";
import { c as normalizeLogEntries, l as prettyJson, s as formatDate } from "../../../../chunks/client.js";
import { n as t, t as language } from "../../../../chunks/i18n.js";
import { t as AppShell } from "../../../../chunks/AppShell.js";
import { t as InlineError } from "../../../../chunks/InlineError.js";
//#region src/lib/components/JsonBlock.svelte
function JsonBlock($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { label, value } = $$props;
		$$renderer.push(`<section class="stack-sm"><h3>${escape_html(label)}</h3> `);
		if (value === void 0 || value === null || prettyJson(value) === "") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "noData"))}</p>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<pre>${escape_html(prettyJson(value))}</pre>`);
		}
		$$renderer.push(`<!--]--></section>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/lib/components/ReactLogView.svelte
function ReactLogView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { runId, initialLogs = [] } = $$props;
		let logs = [];
		$$renderer.push(`<section class="stack card"><div class="row-between"><h2>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "reactLog"))}</h2> <span class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "connecting"))}</span></div> `);
		if (logs.length === 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "noLogEvents"))}</p>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="stack"><!--[-->`);
			const each_array = ensure_array_like(logs);
			for (let index = 0, $$length = each_array.length; index < $$length; index++) {
				let log = each_array[index];
				$$renderer.push(`<article class="log-entry"><div class="row-between log-meta"><strong>${escape_html(log.type ?? t(store_get($$store_subs ??= {}, "$language", language), "event"))}</strong> <span class="muted">#${escape_html(index + 1)} `);
				if (log.iter !== void 0) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`· ${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "iter"))} ${escape_html(log.iter)}`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (log.timestamp) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`· ${escape_html(formatDate(log.timestamp))}`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></span></div> `);
				if (log.stepId) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "step"))}:</strong> ${escape_html(log.stepId)}</p>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (log.tool) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "tool"))}:</strong> ${escape_html(log.tool)}</p>`);
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
		if ($$store_subs) unsubscribe_stores($$store_subs);
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
				$$renderer.push(`<title>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runTitle", { id: data.run ? run.id : data.runId }))} | ${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "appName"))}</title>`);
			});
		});
		{
			function actions($$renderer) {
				if (data.run) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<a class="secondary-button"${attr("href", `/flows/${run.flow_id}`)}>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "backToFlow"))}</a>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<a class="secondary-button" href="/flows">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "backToFlows"))}</a>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			AppShell($$renderer, {
				actions,
				children: ($$renderer) => {
					$$renderer.push(`<div class="page-title-block"><h1>${escape_html(data.run ? t(store_get($$store_subs ??= {}, "$language", language), "runTitle", { id: run.id }) : t(store_get($$store_subs ??= {}, "$language", language), "runDetail"))}</h1> <p class="subtitle">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runSubtitle"))}</p></div> `);
					if (data.error) {
						$$renderer.push("<!--[0-->");
						InlineError($$renderer, {
							error: {
								...data.error,
								title: t(store_get($$store_subs ??= {}, "$language", language), "unableLoadRun", { id: data.runId })
							},
							retryHref: "/flows"
						});
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<section class="run-overview"><article class="card stack"><div class="row-between"><h2>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runStatus"))}</h2> `);
						StatusBadge($$renderer, { value: run.status });
						$$renderer.push(`<!----></div> <p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "flow"))}:</strong> <span class="mono">${escape_html(run.flow_id)}</span></p> <p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "started"))}:</strong> ${escape_html(formatDate(run.created_at))}</p> <p><strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "finished"))}:</strong> ${escape_html(formatDate(run.finished_at))}</p> `);
						JsonBlock($$renderer, {
							label: t(store_get($$store_subs ??= {}, "$language", language), "initialInputs"),
							value: run.initial_inputs
						});
						$$renderer.push(`<!----></article> <article class="card stack"><div class="row-between"><h2>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "steps"))}</h2> <span class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "total", { count: run.steps?.length ?? 0 }))}</span></div> `);
						if (!run.steps || run.steps.length === 0) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<p class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "noStepData"))}</p>`);
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
									label: t(store_get($$store_subs ??= {}, "$language", language), "resolvedInputs"),
									value: step.resolved_inputs
								});
								$$renderer.push(`<!----> `);
								JsonBlock($$renderer, {
									label: t(store_get($$store_subs ??= {}, "$language", language), "outputs"),
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
					}
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
