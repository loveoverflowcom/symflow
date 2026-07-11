import { l as unsubscribe_stores } from "../../chunks/server.js";
import "../../chunks/session.js";
import "../../chunks/theme.js";
//#region src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { children, data } = $$props;
		children?.($$renderer);
		$$renderer.push(`<!---->`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _layout as default };
