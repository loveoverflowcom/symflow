import { createUrl, parseResponse } from '$lib/api/http';
import type { AuthUser, LoginPayload, RegisterPayload } from '$lib/auth/types';

export async function registerUser(
  payload: RegisterPayload,
  fetchImpl: typeof fetch = fetch
): Promise<AuthUser> {
  const response = await fetchImpl(createUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return parseResponse<AuthUser>(response);
}

export async function loginUser(
  payload: LoginPayload,
  fetchImpl: typeof fetch = fetch
): Promise<AuthUser> {
  const response = await fetchImpl(createUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return parseResponse<AuthUser>(response);
}

export async function logoutUser(fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(createUrl('/api/auth/logout'), {
    method: 'POST',
    credentials: 'include'
  });
  return parseResponse<void>(response);
}

export async function getMe(fetchImpl: typeof fetch = fetch): Promise<AuthUser> {
  const response = await fetchImpl(createUrl('/api/auth/me'), {
    credentials: 'include'
  });
  return parseResponse<AuthUser>(response);
}
