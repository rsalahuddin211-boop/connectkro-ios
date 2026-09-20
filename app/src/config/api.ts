function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeApiPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimTrailingSlash(trimmed) : `/${trimTrailingSlash(trimmed)}`;
}

const DEFAULT_DEV_API_ORIGIN = 'https://api.connectkro.com';
const DEFAULT_PRODUCTION_API_ORIGIN = 'https://example.invalid';

function resolveApiOrigin(): string {
  const configuredOrigin = process.env.EXPO_PUBLIC_API_ORIGIN?.trim();

  if (configuredOrigin) {
    return trimTrailingSlash(configuredOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_DEV_API_ORIGIN;
  }

  console.warn(
    'EXPO_PUBLIC_API_ORIGIN is not set for a non-development build. Falling back to a placeholder host.',
  );

  return DEFAULT_PRODUCTION_API_ORIGIN;
}

const API_ORIGIN = resolveApiOrigin();
const API_PREFIX = normalizeApiPrefix(process.env.EXPO_PUBLIC_API_PREFIX || '');
const API_BASE_URL = `${API_ORIGIN}${API_PREFIX}`;

export { API_BASE_URL, API_ORIGIN };

export function buildApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function buildOriginUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${normalizedPath}`;
}
