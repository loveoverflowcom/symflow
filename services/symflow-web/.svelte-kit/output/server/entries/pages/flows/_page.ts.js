import { i as listFlows } from "../../../chunks/client2.js";
//#region src/routes/flows/+page.ts
async function load({ fetch }) {
	return { flows: await listFlows(fetch) };
}
//#endregion
export { load };
