import type { AssetRecord } from '../types/asset';
import { buildApiUrl, buildOriginUrl } from '../config/api';
import { buildTunnelHeaders, fetchWithTimeout, parseApiResponse } from './http';

interface ListAssetsResponse {
  assets: AssetRecord[];
}

interface SingleAssetResponse {
  asset: AssetRecord;
}

interface QuickResponseActionResponse {
  message: string;
  quickResponse?: AssetRecord['quickResponse'];
  asset?: AssetRecord;
}

interface UpdateAssetInput {
  token: string;
  assetId: number;
  name: string;
  categoryId: number;
  notes: string;
  imageUri?: string;
}

interface ReactNativeUpload {
  uri: string;
  name: string;
  type: string;
}

export async function listMyAssets(token: string): Promise<AssetRecord[]> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/assets'), {
    headers: buildTunnelHeaders({ Authorization: `Bearer ${token}` }),
  });
  const data = await parseApiResponse<ListAssetsResponse>(response, 'Failed to load assets');
  return data.assets || [];
}

export async function getSingleAsset(token: string, assetId: number): Promise<AssetRecord> {
  const response = await fetchWithTimeout(buildApiUrl(`/owner/assets/${assetId}`), {
    headers: buildTunnelHeaders({ Authorization: `Bearer ${token}` }),
  });
  const data = await parseApiResponse<SingleAssetResponse>(response, 'Failed to load asset details');
  return data.asset;
}

async function patchQuickResponseStatus(token: string, endpoint: string, assetId: number): Promise<QuickResponseActionResponse> {
  const response = await fetchWithTimeout(buildApiUrl(endpoint), {
    method: 'PATCH',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    body: JSON.stringify({ assetId }),
  });
  return parseApiResponse<QuickResponseActionResponse>(response, 'Failed to update QR status');
}

export function disableQuickResponseByAsset(token: string, assetId: number): Promise<QuickResponseActionResponse> {
  return patchQuickResponseStatus(token, '/owner/assets/disable-quickresponse', assetId);
}

export function enableQuickResponseByAsset(token: string, assetId: number): Promise<QuickResponseActionResponse> {
  return patchQuickResponseStatus(token, '/owner/assets/enable-quickresponse', assetId);
}

export async function setAssetStolenMode(
  token: string,
  assetId: number,
  stolenMode: boolean,
): Promise<QuickResponseActionResponse> {
  const response = await fetchWithTimeout(buildApiUrl('/owner/assets/stolen-mode'), {
    method: 'PATCH',
    headers: buildTunnelHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    body: JSON.stringify({ assetId, stolenMode }),
  });

  return parseApiResponse<QuickResponseActionResponse>(response, 'Failed to update stolen mode');
}

export async function deleteAsset(token: string, assetId: number): Promise<QuickResponseActionResponse> {
  const response = await fetchWithTimeout(buildApiUrl(`/owner/assets/${assetId}`), {
    method: 'DELETE',
    headers: buildTunnelHeaders({
      Authorization: `Bearer ${token}`,
    }),
  });

  return parseApiResponse<QuickResponseActionResponse>(response, 'Failed to delete asset');
}

export async function updateOwnerAsset(input: UpdateAssetInput): Promise<QuickResponseActionResponse> {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('categoryId', String(input.categoryId));
  formData.append('notes', input.notes);

  if (input.imageUri) {
    const imageFile: ReactNativeUpload = {
      uri: input.imageUri,
      name: 'image-1.jpg',
      type: 'image/jpeg',
    };

    formData.append('images', imageFile as unknown as Blob);
  }

  const response = await fetch(buildApiUrl(`/owner/assets/${input.assetId}`), {
    method: 'PATCH',
    headers: buildTunnelHeaders({
      Authorization: `Bearer ${input.token}`,
    }),
    body: formData,
  });

  return parseApiResponse<QuickResponseActionResponse>(response, 'Failed to update asset');
}

export function toAbsoluteAssetUrl(path?: string) {
  if (!path) return '';
  return buildOriginUrl(path);
}

