import { a as head, b as attr, i as ensure_array_like, x as escape_html } from "../../../chunks/server.js";
import { t as AppShell } from "../../../chunks/AppShell.js";
import { t as formatDate } from "../../../chunks/format.js";
//#region src/routes/flows/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		head("1pxgtoa", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>Flows | Symflow</title>`);
			});
		});
		{
			function actions($$renderer) {
				$$renderer.push(`<a class="primary-button" href="/flows/new">New flow</a>`);
			}
			AppShell($$renderer, {
				title: "Flows",
				subtitle: "Manage flow definitions and jump into editing or execution.",
				actions,
				children: ($$renderer) => {
					if (data.flows.length === 0) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<section class="card empty-state"><h2>No flows yet</h2> <p class="muted">Create the first flow to start authoring the YAML DSL and trigger runs.</p></section>`);
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<section class="grid"><!--[-->`);
						const each_array = ensure_array_like(data.flows);
						for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
							let flow = each_array[$$index];
							$$renderer.push(`<a class="card flow-card"${attr("href", `/flows/${flow.id}`)}><div class="stack-sm"><h2>${escape_html(flow.name)}</h2> <p class="mono">${escape_html(flow.id)}</p> <p class="muted">Created ${escape_html(formatDate(flow.created_at))}</p></div></a>`);
						}
						$$renderer.push(`<!--]--></section>`);
					}
					$$renderer.push(`<!--]-->`);
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
