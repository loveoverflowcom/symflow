import { describe, expect, it, vi } from 'vitest';
import { getMe, loginUser, logoutUser, registerUser } from '../src/lib/api/auth';

const user = { id: 'user-id', username: 'alice' };

describe('auth API client', () => {
  it('sends credentials for register and login', async () => {
    const fetchMock = vi.fn(async () => Response.json(user));

    await registerUser({ username: 'alice', password: 'secret123' }, fetchMock);
    await loginUser({ username: 'alice', password: 'secret123' }, fetchMock);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/register',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/login',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('sends credentials for me and logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(user))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await getMe(fetchMock);
    await logoutUser(fetchMock);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });
});
