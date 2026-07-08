import "../../../../chunks/server.js";
import { t as Shared_editor } from "../../../../chunks/shared-editor.js";
//#region src/routes/flows/[id]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		Shared_editor($$renderer, { flow: data.flow });
	});
}
//#endregion
export { _page as default };
