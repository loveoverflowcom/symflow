import { getFlow } from '$lib/api/client';

export async function load({ fetch, params }) {
  return {
    flow: await getFlow(params.id, fetch)
  };
}
