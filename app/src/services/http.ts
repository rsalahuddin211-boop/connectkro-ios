import * as Device from 'expo-device';
import { Platform } from 'react-native';

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

const LOCALTUNNEL_BYPASS_HEADER = 'bypass-tunnel-reminder';
const REQUEST_TIMEOUT_MS = 10000;

function isLikelyAndroidEmulator(): boolean {
  return Platform.OS === 'android' && Device.isDevice === false;
}

function toUrl(input: Parameters<typeof fetch>[0]): URL | null {
  if (typeof input === 'string') {
    try {
      return new URL(input);
    } catch {
      return null;
    }
  }

  if (input instanceof URL) {
    return input;
  }

  return null;
}

function buildFallbackInputs(input: Parameters<typeof fetch>[0]): Parameters<typeof fetch>[0][] {
  const url = toUrl(input);

  if (!url || url.protocol !== 'http:' || !isLikelyAndroidEmulator()) {
    return [];
  }

  if (url.hostname === '10.0.2.2') {
    return [];
  }

  const fallbackUrl = new URL(url.toString());
  fallbackUrl.hostname = '10.0.2.2';

  return [fallbackUrl.toString()];
}

async function runFetchAttempt(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractErrorMessage(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes('telnyx') ||
        lowerMessage.includes('verify_profile_id') ||
        lowerMessage.includes('verification service is not configured')
      ) {
        return 'Verification is temporarily unavailable. Please try again later.';
      }

      return message;
    }
  }

  if (typeof data === 'string' && data.trim()) {
    const lowerMessage = data.toLowerCase();

    if (
      lowerMessage.includes('telnyx') ||
      lowerMessage.includes('verify_profile_id') ||
      lowerMessage.includes('verification service is not configured')
    ) {
      return 'Verification is temporarily unavailable. Please try again later.';
    }

    return data;
  }

  return null;
}

function extractErrorCode(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'code' in data) {
    const code = (data as { code?: unknown }).code;
    return typeof code === 'string' && code.trim() ? code : null;
  }

  return null;
}

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();

  let data: unknown = null;

  if (rawBody.trim()) {
    if (contentType.includes('application/json')) {
      try {
        data = parseJson(rawBody);
      } catch {
        if (response.ok) {
          throw new Error('We got an unexpected response. Please try again.');
        }

        data = rawBody;
      }
    } else {
      data = rawBody;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(data) || fallbackMessage,
      response.status,
      extractErrorCode(data),
    );
  }

  return data as T;
}

export function buildTunnelHeaders(headers?: Record<string, string>): Record<string, string> {
  return {
    [LOCALTUNNEL_BYPASS_HEADER]: '1',
    ...(headers || {}),
  };
}

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const requestInputs = [input, ...buildFallbackInputs(input)];
  let lastError: unknown = null;

  for (let index = 0; index < requestInputs.length; index += 1) {
    const requestInput = requestInputs[index];

    try {
      return await runFetchAttempt(requestInput, init, timeoutMs);
    } catch (error) {
      lastError = error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          'Request timed out. Please check your internet connection and try again.',
          { cause: error },
        );
      }

      const hasFallbackRemaining = index < requestInputs.length - 1;
      if (hasFallbackRemaining) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}
