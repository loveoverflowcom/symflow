import { getFlow } from '$lib/api/client';
import { toViewError } from '$lib/api/errors';

export async function load({ fetch, params }) {
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
