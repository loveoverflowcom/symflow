import { getRun } from '$lib/api/client';

export async function load({ fetch, params }) {
  return {
    run: await getRun(params.id, fetch)
  };
}
