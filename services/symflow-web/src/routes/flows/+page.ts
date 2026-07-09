import { listFlows } from '$lib/api/client';
import { toViewError } from '$lib/api/errors';

export async function load({ fetch }) {
  try {
    return {
      flows: await listFlows(fetch),
      error: null
    };
  } catch (error) {
    return {
      flows: [],
      error: toViewError(error, 'Unable to load flows')
    };
  }
}
