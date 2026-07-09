import { r as getRun } from "../../../../chunks/client.js";
import { t as toViewError } from "../../../../chunks/errors.js";
//#region src/routes/runs/[id]/+page.ts
async function load({ fetch, params }) {
	try {
		return {
			run: await getRun(params.id, fetch),
			error: null,
			runId: params.id
		};
	} catch (error) {
		return {
			run: null,
			error: toViewError(error, `Unable to load run ${params.id}`),
			runId: params.id
		};
	}
}
//#endregion
export { load };
