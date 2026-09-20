import { buildApiUrl } from '../config/api';
import { buildTunnelHeaders, parseApiResponse } from './http';

export type PushPlatform = 'android' | 'ios';

interface PushTokenMutationResponse {
  message: string;
}

function authHeaders(token: string) {
  return buildTunnelHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });
}

export async function registerOwnerPushToken(
  token: string,
  pushToken: string,
  platform: PushPlatform,
): Promise<PushTokenMutationResponse> {
  const response = await fetch(buildApiUrl('/owner/push-tokens'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      token: pushToken,
      platform,
    }),
  });

  return parseApiResponse<PushTokenMutationResponse>(response, 'Failed to register push token');
}

export async function unregisterOwnerPushToken(
  token: string,
  pushToken: string,
): Promise<PushTokenMutationResponse> {
  const response = await fetch(buildApiUrl('/owner/push-tokens'), {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({
      token: pushToken,
    }),
  });

  return parseApiResponse<PushTokenMutationResponse>(response, 'Failed to unregister push token');
}
