import type { IoniconName } from '../utils/assetPresentation';
import { buildApiUrl } from '../config/api';
import type { AssetCategory } from '../types/assetCategory';
import { buildTunnelHeaders, fetchWithTimeout, parseApiResponse } from './http';

interface AssetCategoriesResponse {
  categories: AssetCategory[];
}

let categoryCache: AssetCategory[] | null = null;
let inFlightRequest: Promise<AssetCategory[]> | null = null;

const ICON_BY_KEY: Record<string, IoniconName> = {
  bike: 'bicycle-outline',
  car: 'car-sport-outline',
  laptop: 'laptop-outline',
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

export function getAssetCategoryIconName(category: AssetCategory | null | undefined): IoniconName {
  const iconKey = normalizeValue(category?.iconKey || '');
  return ICON_BY_KEY[iconKey] || 'cube-outline';
}

export function getAssetCategoryOption(
  value: string,
  categories: AssetCategory[],
): AssetCategory | null {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    categories.find((category) => {
      return (
        normalizeValue(category.label) === normalizedValue ||
        normalizeValue(category.slug) === normalizedValue
      );
    }) || null
  );
}

export async function listAssetCategories(forceRefresh = false): Promise<AssetCategory[]> {
  if (!forceRefresh && categoryCache) {
    return categoryCache;
  }

  if (!forceRefresh && inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = fetchWithTimeout(buildApiUrl('/catalog/asset-categories'), {
    headers: buildTunnelHeaders(),
  })
    .then((response) =>
      parseApiResponse<AssetCategoriesResponse>(response, 'Failed to load asset categories'),
    )
    .then((data) => {
      categoryCache = data.categories || [];
      return categoryCache;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}
