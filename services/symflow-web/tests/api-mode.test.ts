import { describe, expect, it } from 'vitest';
import { resolveApiMode } from '../src/lib/api/mode';
import { createApiUrl, createWebSocketUrl, resolveApiBaseUrl } from '../src/lib/api/url';

describe('resolveApiMode', () => {
  it('defaults to production', () => {
    expect(resolveApiMode({})).toBe('production');
  });

  it('accepts explicit mock mode', () => {
    expect(resolveApiMode({ PUBLIC_API_MODE: 'mock' })).toBe('mock');
  });

  it('accepts explicit production mode', () => {
    expect(resolveApiMode({ PUBLIC_API_MODE: 'production' })).toBe('production');
    expect(resolveApiMode({ PUBLIC_API_MODE: 'prod' })).toBe('production');
  });

  it('honors the legacy mock flag', () => {
    expect(resolveApiMode({ PUBLIC_USE_MOCK_API: 'true' })).toBe('mock');
  });
});

describe('api url helpers', () => {
  it('defaults to same-origin api routes', () => {
    expect(resolveApiBaseUrl({})).toBe('');
    expect(createApiUrl('/api/flows', '')).toBe('/api/flows');
  });

  it('builds absolute urls when configured', () => {
    expect(resolveApiBaseUrl({ PUBLIC_API_BASE_URL: 'http://127.0.0.1:8787/' })).toBe('http://127.0.0.1:8787');
    expect(createApiUrl('/api/flows', 'http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787/api/flows');
    expect(createWebSocketUrl('/api/runs/demo/logs', 'http://127.0.0.1:8787')).toBe(
      'ws://127.0.0.1:8787/api/runs/demo/logs'
    );
  });
});
