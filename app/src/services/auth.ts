import type {
  OwnerForgotPasswordRequestPayload,
  OwnerForgotPasswordRequestResponse,
  OwnerForgotPasswordResetPayload,
  OwnerForgotPasswordResetResponse,
  OwnerLoginPayload,
  OwnerLoginResponse,
  OwnerSignupPayload,
  OwnerSignupResponse,
  OwnerVerifyPayload,
  OwnerVerificationOtpRequestPayload,
  OwnerVerificationOtpRequestResponse,
  OwnerVerifyResponse,
} from '../types/auth';
import { buildApiUrl } from '../config/api';
import { buildTunnelHeaders, fetchWithTimeout, parseApiResponse } from './http';
import type { OwnerRecord } from '../types/auth';

interface VerificationRequiredResponse {
  message: string;
  requiresVerification?: boolean;
  owner?: OwnerRecord;
}

export class LoginRequiresVerificationError extends Error {
  owner?: OwnerRecord;

  constructor(message: string, options?: { owner?: OwnerRecord }) {
    super(message);
    this.name = 'LoginRequiresVerificationError';
    this.owner = options?.owner;
  }
}

export async function signupOwner(payload: OwnerSignupPayload): Promise<OwnerSignupResponse> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/auth/signup'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<OwnerSignupResponse>(response, 'Signup failed');
}

export async function verifyOwner(payload: OwnerVerifyPayload): Promise<OwnerVerifyResponse> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/auth/verify'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<OwnerVerifyResponse>(response, 'Verification failed');
}

export async function requestOwnerVerificationOtp(
  payload: OwnerVerificationOtpRequestPayload,
): Promise<OwnerVerificationOtpRequestResponse> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/auth/verify/request'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<OwnerVerificationOtpRequestResponse>(
    response,
    'Failed to resend verification OTP',
  );
}

export async function loginOwner(payload: OwnerLoginPayload): Promise<OwnerLoginResponse> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/auth/login'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (response.status === 403) {
    const rawBody = await response.text();
    let data: VerificationRequiredResponse | null = null;

    if (rawBody.trim()) {
      try {
        data = JSON.parse(rawBody) as VerificationRequiredResponse;
      } catch {
        data = null;
      }
    }

    if (data?.requiresVerification || data?.message === 'Owner is not verified yet') {
      throw new LoginRequiresVerificationError(data?.message || 'Owner is not verified yet', {
        owner: data?.owner,
      });
    }

    const retryResponse = new Response(rawBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    return parseApiResponse<OwnerLoginResponse>(retryResponse, 'Login failed');
  }

  return parseApiResponse<OwnerLoginResponse>(response, 'Login failed');
}

export async function requestOwnerForgotPasswordOtp(
  payload: OwnerForgotPasswordRequestPayload,
): Promise<OwnerForgotPasswordRequestResponse> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/auth/forgot-password/request'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<OwnerForgotPasswordRequestResponse>(response, 'Failed to send forgot password OTP');
}

export async function resetOwnerForgottenPassword(
  payload: OwnerForgotPasswordResetPayload,
): Promise<OwnerForgotPasswordResetResponse> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/auth/forgot-password/reset'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<OwnerForgotPasswordResetResponse>(response, 'Failed to reset password');
}
