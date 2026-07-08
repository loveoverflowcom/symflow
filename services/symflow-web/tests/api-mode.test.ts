import { describe, expect, it } from 'vitest';
import { resolveApiMode } from '../src/lib/api/mode';

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
