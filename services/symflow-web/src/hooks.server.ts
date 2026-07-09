import type { HandleFetch } from '@sveltejs/kit';

const LOCAL_API_ORIGIN = 'http://127.0.0.1:8787';

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  const url = new URL(request.url);

  if (url.origin === event.url.origin && url.pathname.startsWith('/api/')) {
    const target = new URL(`${url.pathname}${url.search}`, `${LOCAL_API_ORIGIN}/`);
    return fetch(new Request(target, request));
  }

  return fetch(request);
};
