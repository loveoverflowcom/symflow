import { redirect } from '@sveltejs/kit';
import { getMe } from '$lib/api/client';
import type { AuthUser } from '$lib/auth/types';

export const ssr = false;
export const prerender = false;

export async function load({ fetch, url }) {
  const publicRoute = url.pathname === '/login' || url.pathname === '/register';
  let user: AuthUser | null = null;

  try {
    user = await getMe(fetch);
  } catch {
    user = null;
  }

  if (user && publicRoute) {
    throw redirect(303, '/');
  }
  if (!user && !publicRoute) {
    const redirectTo = `${url.pathname}${url.search}`;
    throw redirect(303, `/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  return { user };
}
