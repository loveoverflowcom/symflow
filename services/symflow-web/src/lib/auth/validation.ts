export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;
export const PASSWORD_RE = /^\S{8,32}$/u;

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function validateUsername(username: string): ValidationResult {
  return USERNAME_RE.test(username)
    ? { ok: true }
    : { ok: false, message: 'usernameRules' };
}

export function validatePassword(password: string): ValidationResult {
  return PASSWORD_RE.test(password)
    ? { ok: true }
    : { ok: false, message: 'passwordRules' };
}
