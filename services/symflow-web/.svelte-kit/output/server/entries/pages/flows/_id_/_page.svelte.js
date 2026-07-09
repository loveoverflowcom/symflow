import { o as store_get, s as unsubscribe_stores, x as escape_html } from "../../../../chunks/server.js";
import { n as t, t as language } from "../../../../chunks/i18n.js";
import { t as AppShell } from "../../../../chunks/AppShell.js";
import { t as InlineError } from "../../../../chunks/InlineError.js";
import { t as Shared_editor } from "../../../../chunks/shared-editor.js";
//#region src/routes/flows/[id]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { data } = $$props;
		if (data.flow) {
			$$renderer.push("<!--[0-->");
			Shared_editor($$renderer, { flow: data.flow });
		} else if (data.error) {
			$$renderer.push("<!--[1-->");
			{
				function actions($$renderer) {
					$$renderer.push(`<a class="secondary-button" href="/flows">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "backToFlows"))}</a>`);
				}
				AppShell($$renderer, {
					actions,
					children: ($$renderer) => {
						$$renderer.push(`<div class="page-title-block"><h1>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "editFlow"))}</h1> <p class="subtitle">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "editFlowUnavailable"))}</p></div> `);
						InlineError($$renderer, {
							error: {
								...data.error,
								title: t(store_get($$store_subs ??= {}, "$language", language), "unableLoadFlow", { id: data.flowId })
							},
							retryHref: "/flows"
						});
						$$renderer.push(`<!---->`);
					},
					$$slots: {
						actions: true,
						default: true
					}
				});
			}
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
