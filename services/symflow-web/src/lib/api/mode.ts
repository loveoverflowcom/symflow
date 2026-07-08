export type ApiMode = 'production' | 'mock';

export type ApiEnv = {
  PUBLIC_API_MODE?: string;
  PUBLIC_USE_MOCK_API?: string;
};

export function resolveApiMode(env: ApiEnv = import.meta.env as unknown as ApiEnv): ApiMode {
  const explicitMode = normalizeMode(env.PUBLIC_API_MODE);
  if (explicitMode) {
    return explicitMode;
  }

  const legacyMockFlag = String(env.PUBLIC_USE_MOCK_API || '').toLowerCase() === 'true';
  return legacyMockFlag ? 'mock' : 'production';
}

function normalizeMode(value?: string): ApiMode | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mock') {
    return 'mock';
  }
  if (normalized === 'production' || normalized === 'prod') {
    return 'production';
  }
  return null;
}
