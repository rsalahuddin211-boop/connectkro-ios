import type { OwnerNotification } from '../types/asset';
import { buildApiUrl } from '../config/api';
import { buildTunnelHeaders, parseApiResponse } from './http';

interface OwnerNotificationsResponse {
  notificationsReadAt?: string | null;
  unreadCount: number;
  notifications: OwnerNotification[];
}

interface MarkNotificationsReadResponse {
  message: string;
  notificationsReadAt?: string | null;
}

function authHeaders(token: string) {
  return buildTunnelHeaders({
    Authorization: `Bearer ${token}`,
  });
}

export async function getOwnerNotifications(
  token: string,
  limit = 10,
): Promise<OwnerNotificationsResponse> {
  const response = await fetch(buildApiUrl(`/owner/notifications?limit=${limit}`), {
    headers: authHeaders(token),
  });

  return parseApiResponse<OwnerNotificationsResponse>(response, 'Failed to load notifications');
}

export async function markOwnerNotificationsRead(token: string): Promise<MarkNotificationsReadResponse> {
  const response = await fetch(buildApiUrl('/owner/notifications/read'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
      ...authHeaders(token),
    }),
    body: JSON.stringify({}),
  });

  return parseApiResponse<MarkNotificationsReadResponse>(response, 'Failed to update notifications');
}
