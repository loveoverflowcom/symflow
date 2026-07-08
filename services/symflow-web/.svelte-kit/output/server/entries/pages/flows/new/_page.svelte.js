import "../../../../chunks/server.js";
import { t as Shared_editor } from "../../../../chunks/shared-editor.js";
//#region src/routes/flows/new/+page.svelte
function _page($$renderer) {
	Shared_editor($$renderer, {});
}
//#endregion
export { _page as default };
