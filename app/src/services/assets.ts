import { buildApiUrl } from '../config/api';
import { buildTunnelHeaders, parseApiResponse } from './http';

export interface CreateAssetInput {
  token: string;
  name: string;
  categoryId: number;
  quickResponseUniqueId: string;
  imageUri: string;
  notes?: string;
}

interface ReactNativeUpload {
  uri: string;
  name: string;
  type: string;
}

interface CreateAssetResponse {
  message: string;
}

interface ErrorResponseBody {
  message?: string;
  reason?: string;
}

export class AssetAttachmentError extends Error {
  reason?: string;
  statusCode: number;

  constructor(message: string, options: { reason?: string; statusCode: number }) {
    super(message);
    this.name = 'AssetAttachmentError';
    this.reason = options.reason;
    this.statusCode = options.statusCode;
  }
}

async function readErrorResponse(response: Response): Promise<ErrorResponseBody> {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as ErrorResponseBody;
  } catch {
    return { message: rawBody };
  }
}

export async function createAssetAndAttachQuickResponse(input: CreateAssetInput) {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('categoryId', String(input.categoryId));
  formData.append('quickResponseUniqueId', input.quickResponseUniqueId);

  if (input.notes?.trim()) {
    formData.append('notes', input.notes.trim());
  }

  const imageFile: ReactNativeUpload = {
    uri: input.imageUri,
    name: 'image-1.jpg',
    type: 'image/jpeg',
  };

  formData.append('images', imageFile as unknown as Blob);

  const response = await fetch(buildApiUrl('/owner/assets'), {
    method: 'POST',
    headers: buildTunnelHeaders({
      Authorization: `Bearer ${input.token}`,
    }),
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await readErrorResponse(response);
    throw new AssetAttachmentError(
      errorBody.message || 'Failed to create asset',
      {
        reason: errorBody.reason,
        statusCode: response.status,
      },
    );
  }

  return parseApiResponse<CreateAssetResponse>(response, 'Failed to create asset');
}

