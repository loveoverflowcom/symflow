import { describe, expect, it } from 'vitest';
import { validatePassword, validateUsername } from '../src/lib/auth/validation';

describe('auth validation', () => {
  it('matches the username contract', () => {
    expect(validateUsername('user_01')).toEqual({ ok: true });
    expect(validateUsername('ab')).toMatchObject({ ok: false });
    expect(validateUsername('user name')).toMatchObject({ ok: false });
    expect(validateUsername('user@example.com')).toMatchObject({ ok: false });
  });

  it('matches the password contract', () => {
    expect(validatePassword('secret123')).toEqual({ ok: true });
    expect(validatePassword('short')).toMatchObject({ ok: false });
    expect(validatePassword('pass word123')).toMatchObject({ ok: false });
    expect(validatePassword('a'.repeat(33))).toMatchObject({ ok: false });
  });
});
