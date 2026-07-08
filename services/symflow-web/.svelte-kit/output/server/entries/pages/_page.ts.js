import { redirect } from "@sveltejs/kit";
//#region src/routes/+page.ts
function load() {
	throw redirect(307, "/flows");
}
//#endregion
export { load };
