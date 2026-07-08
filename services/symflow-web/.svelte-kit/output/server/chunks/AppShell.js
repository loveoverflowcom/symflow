import { x as escape_html } from "./server.js";
//#region src/lib/components/AppShell.svelte
function AppShell($$renderer, $$props) {
	let { title, subtitle, actions, children } = $$props;
	$$renderer.push(`<div class="page-shell"><header class="page-header"><div><p class="eyebrow">FlowAgent Engine</p> <h1>${escape_html(title)}</h1> `);
	if (subtitle) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<p class="subtitle">${escape_html(subtitle)}</p>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></div> `);
	if (actions) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="actions">`);
		actions($$renderer);
		$$renderer.push(`<!----></div>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></header> `);
	if (children) {
		$$renderer.push("<!--[0-->");
		children($$renderer);
		$$renderer.push(`<!---->`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></div>`);
}
//#endregion
export { AppShell as t };
