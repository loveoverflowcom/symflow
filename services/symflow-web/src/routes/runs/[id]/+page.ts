import { getRun } from '$lib/api/client';
import { toViewError } from '$lib/api/errors';

export async function load({ fetch, params }) {
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
