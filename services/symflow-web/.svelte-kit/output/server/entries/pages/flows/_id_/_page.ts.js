import { t as getFlow } from "../../../../chunks/client2.js";
//#region src/routes/flows/[id]/+page.ts
async function load({ fetch, params }) {
	return { flow: await getFlow(params.id, fetch) };
}
//#endregion
export { load };
