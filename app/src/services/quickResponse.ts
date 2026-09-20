import { buildApiUrl } from '../config/api';
import { buildTunnelHeaders, parseApiResponse } from './http';

export interface QuickResponseResponse {
  url: string;
  uniqueId: string;
  statusCode: string;
  message: string;
}

export interface QuickResponseClaimStatusResponse {
  claimable: boolean;
  reason: string;
  message: string;
}

/**
 * Check the status of a quickResponse by its unique ID.
 * GET /quickresponses/:uniqueId
 */
export async function checkQuickResponseStatus(quickResponseId: string): Promise<QuickResponseResponse> {
  const response = await fetch(buildApiUrl(`/quickresponses/${quickResponseId}?skipActivity=true`), {
    headers: buildTunnelHeaders(),
  });
  return parseApiResponse<QuickResponseResponse>(response, 'Failed to check QR status');
}

export async function checkQuickResponseClaimStatus(
  token: string,
  quickResponseId: string,
): Promise<QuickResponseClaimStatusResponse> {
  const response = await fetch(buildApiUrl(`/owner/quickresponses/${quickResponseId}/claim-status`), {
    headers: buildTunnelHeaders({
      Authorization: `Bearer ${token}`,
    }),
  });

  return parseApiResponse<QuickResponseClaimStatusResponse>(
    response,
    'Failed to check whether this QR can be claimed',
  );
}

