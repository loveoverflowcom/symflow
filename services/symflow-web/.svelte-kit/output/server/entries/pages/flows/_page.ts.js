import { a as listFlows } from "../../../chunks/client.js";
import { t as toViewError } from "../../../chunks/errors.js";
//#region src/routes/flows/+page.ts
async function load({ fetch }) {
	try {
		return {
			flows: await listFlows(fetch),
			error: null
		};
	} catch (error) {
		return {
			flows: [],
			error: toViewError(error, "Unable to load flows")
		};
	}
}
//#endregion
export { load };
