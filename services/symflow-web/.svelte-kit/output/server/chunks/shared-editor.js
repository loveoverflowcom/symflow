import { b as attr, i as head, n as derived, o as store_get, s as unsubscribe_stores, x as escape_html } from "./server.js";
import "./internal2.js";
import { d as parseJsonDsl, u as DEFAULT_FLOW_DSL } from "./client.js";
import { n as t, t as language } from "./i18n.js";
import { t as AppShell } from "./AppShell.js";
//#region src/routes/flows/shared-editor.svelte
function Shared_editor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { flow } = $$props;
		let name = "";
		let dslScript = DEFAULT_FLOW_DSL;
		let runInputsText = "{\n  \"input\": \"example\"\n}";
		const pageTitle = derived(() => flow ? t(store_get($$store_subs ??= {}, "$language", language), "editFlow") : t(store_get($$store_subs ??= {}, "$language", language), "newFlow"));
		derived(() => {
			try {
				const parsed = parseJsonDsl(dslScript);
				if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) return null;
				return parsed;
			} catch {
				return null;
			}
		});
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
						$$renderer.push(`<div class="page-title-block"><h1>${escape_html(pageTitle())}</h1> <p class="subtitle">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "editorSubtitle"))}</p></div> <section class="editor-layout"><article class="card stack"><label class="stack-sm"><span>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "name"))}</span> <input${attr("value", name)} placeholder="hello-world-flow"/></label> `);
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> <div class="button-row"><button class="primary-button" type="button"${attr("disabled", true, true)}>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "saveFlow"))}</button></div></article> <aside class="card stack"><div class="stack-sm"><h2>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runFlow"))}</h2> <p class="muted">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runFlowDescription"))}</p></div> <label class="stack-sm"><span>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "inputs"))}</span> <textarea class="dsl-editor compact" spellcheck="false">`);
						const $$body = escape_html(runInputsText);
						if ($$body) $$renderer.push(`${$$body}`);
						$$renderer.push(`</textarea></label> <button class="primary-button" type="button"${attr("disabled", true, true)}>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "runFlow"))}</button></aside></section>`);
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
