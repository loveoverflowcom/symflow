import { n as getRun } from "../../../../chunks/client2.js";
//#region src/routes/runs/[id]/+page.ts
async function load({ fetch, params }) {
	return { run: await getRun(params.id, fetch) };
}
//#endregion
export { load };
