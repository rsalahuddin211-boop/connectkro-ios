import { buildApiUrl } from '../config/api';
import { fetchWithTimeout, parseApiResponse } from './http';

export interface PublicPlatformSettings {
  appLogoDataUrl: string | null;
  companyPhone: string;
  companyEmail: string;
  updatedAt: string | null;
}

interface PublicPlatformSettingsResponse {
  settings: PublicPlatformSettings;
}

export interface PublicHtmlDocument {
  html: string;
  updatedAt: string | null;
}

interface PublicHtmlDocumentResponse {
  policy: PublicHtmlDocument;
}

interface PublicHtmlPageResponse {
  page: PublicHtmlDocument;
}

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings> {
  const response = await fetchWithTimeout(buildApiUrl('/catalog/platform-settings'));
  const data = await parseApiResponse<PublicPlatformSettingsResponse>(
    response,
    'Failed to load platform settings',
  );

  return data.settings;
}

export async function getPublicPrivacyPolicy(): Promise<PublicHtmlDocument> {
  const response = await fetchWithTimeout(buildApiUrl('/catalog/privacy-policy'));
  const data = await parseApiResponse<PublicHtmlDocumentResponse>(
    response,
    'Failed to load privacy policy',
  );

  return data.policy;
}

export async function getPublicTermsConditions(): Promise<PublicHtmlDocument> {
  const response = await fetchWithTimeout(buildApiUrl('/catalog/terms-and-conditions'));
  const data = await parseApiResponse<PublicHtmlPageResponse>(
    response,
    'Failed to load terms and conditions',
  );

  return data.page;
}
