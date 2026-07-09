export type ApiUrlEnv = {
  PUBLIC_API_BASE_URL?: string;
};

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export function resolveApiBaseUrl(env: ApiUrlEnv = import.meta.env as unknown as ApiUrlEnv): string {
  return String(env.PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
}

function assertAbsoluteBaseUrl(baseUrl: string): void {
  if (baseUrl && !ABSOLUTE_URL_PATTERN.test(baseUrl)) {
    throw new Error(`PUBLIC_API_BASE_URL must be an absolute URL, received "${baseUrl}"`);
  }
}

export function createApiUrl(path: string, baseUrl = resolveApiBaseUrl()): string {
  assertAbsoluteBaseUrl(baseUrl);

  if (!baseUrl) {
    return path;
  }

  return new URL(path, `${baseUrl}/`).toString();
}

export function createWebSocketUrl(
  path: string,
  baseUrl = resolveApiBaseUrl(),
  locationOrigin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  assertAbsoluteBaseUrl(baseUrl);

  const targetOrigin = baseUrl || locationOrigin;
  if (!targetOrigin) {
    return '';
  }

  const url = new URL(path, baseUrl ? `${baseUrl}/` : targetOrigin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
