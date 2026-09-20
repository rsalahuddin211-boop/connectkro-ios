import type { OwnerRecord } from '../types/auth';
import { buildApiUrl } from '../config/api';
import { buildTunnelHeaders, parseApiResponse } from './http';

interface OwnerProfileResponse {
  message?: string;
  owner: OwnerRecord;
}

export interface OwnerProfileUpdatePayload {
  allowEmergencyContact?: boolean;
  emergencyContactPhone?: string | null;
  pushNotificationsEnabled?: boolean;
  name?: string;
}

function authHeaders(token: string, includeJson = false) {
  return buildTunnelHeaders({
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });
}

export async function getOwnerProfile(token: string): Promise<OwnerRecord> {
  const response = await fetch(buildApiUrl('/owner/profile'), {
    headers: authHeaders(token),
  });
  const data = await parseApiResponse<OwnerProfileResponse>(response, 'Failed to load profile');
  return data.owner;
}

export async function updateOwnerProfile(
  token: string,
  payload: OwnerProfileUpdatePayload,
): Promise<OwnerProfileResponse> {
  const response = await fetch(buildApiUrl('/owner/profile'), {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<OwnerProfileResponse>(response, 'Failed to update profile');
}
