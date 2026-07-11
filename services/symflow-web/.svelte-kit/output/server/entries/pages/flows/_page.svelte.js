import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, l as unsubscribe_stores, o as head } from "../../../chunks/server.js";
import { s as formatDate } from "../../../chunks/client.js";
import { n as t, t as language } from "../../../chunks/i18n.js";
import { t as AppShell } from "../../../chunks/AppShell.js";
import { t as InlineError } from "../../../chunks/InlineError.js";
//#region src/routes/flows/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { data } = $$props;
		head("1pxgtoa", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "flowsTitle"))} | ${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "appName"))}</title>`);
			});
		});
		{
			function actions($$renderer) {
				$$renderer.push(`<a class="primary-button" href="/flows/new">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "newFlow"))}</a>`);
			}
			AppShell($$renderer, {
				actions,
				children: ($$renderer) => {
					$$renderer.push(`<div class="page-title-block"><h1>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "flowsTitle"))}</h1> <p class="subtitle">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "flowsSubtitle"))}</p></div> `);
					if (data.error) {
						$$renderer.push("<!--[0-->");
						InlineError($$renderer, {
							error: {
								...data.error,
								title: t(store_get($$store_subs ??= {}, "$language", language), "unableLoadFlows")
							},
							retryHref: "/flows"
						});
					} else if (data.flows.length === 0) {
						$$renderer.push("<!--[1-->");
						$$renderer.push(`<section class="card empty-state"><h2>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "noFlowsYet"))}</h2> <p class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "noFlowsDescription"))}</p></section>`);
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<section class="grid"><!--[-->`);
						const each_array = ensure_array_like(data.flows);
						for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
							let flow = each_array[$$index];
							$$renderer.push(`<a class="card flow-card"${attr("href", `/flows/${flow.id}`)}><div class="stack-sm"><h2>${escape_html(flow.name)}</h2> <p class="mono">${escape_html(flow.id)}</p> <p class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "created", { date: formatDate(flow.created_at) }))}</p></div></a>`);
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
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
