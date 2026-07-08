import { listFlows } from '$lib/api/client';

export async function load({ fetch }) {
  return {
    flows: await listFlows(fetch)
  };
}
