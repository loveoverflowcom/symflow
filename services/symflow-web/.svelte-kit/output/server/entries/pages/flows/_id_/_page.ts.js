import { t as getFlow } from "../../../../chunks/client.js";
import { t as toViewError } from "../../../../chunks/errors.js";
//#region src/routes/flows/[id]/+page.ts
async function load({ fetch, params }) {
	try {
		return {
			flow: await getFlow(params.id, fetch),
			error: null,
			flowId: params.id
		};
	} catch (error) {
		return {
			flow: null,
			error: toViewError(error, `Unable to load flow ${params.id}`),
			flowId: params.id
		};
	}
}
//#endregion
export { load };
