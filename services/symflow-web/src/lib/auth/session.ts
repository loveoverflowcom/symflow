import { writable } from 'svelte/store';
import { getMe } from '$lib/api/client';
import type { AuthUser } from '$lib/auth/types';

export const authUser = writable<AuthUser | null>(null);
export const authLoading = writable(true);

export async function refreshAuth(fetchImpl: typeof fetch = fetch): Promise<AuthUser | null> {
  authLoading.set(true);
  try {
    const user = await getMe(fetchImpl);
    authUser.set(user);
    return user;
  } catch {
    authUser.set(null);
    return null;
  } finally {
    authLoading.set(false);
  }
}

export function setAuthUser(user: AuthUser | null): void {
  authUser.set(user);
  authLoading.set(false);
}

export function clearAuth(): void {
  setAuthUser(null);
}
