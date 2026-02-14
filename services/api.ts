import { CityweftPayload } from '../types';

const API_BASE_URL = 'https://api.cityweft.com/v1';

export interface GeometryResponse {
  origin: [number, number];
  geometry: Array<{
    type: string;
    geometryType: string;
    meshes?: Array<{
      vertices: number[];
      descriptor?: Record<string, any>;
    }>;
    nodes?: Array<{
      type?: string;
      x?: number;
      y?: number;
      z?: number;
      scale?: number;
      rotation?: number;
      [key: string]: any;
    }>;
  }>;
}

/**
 * Fetch geometry JSON from Cityweft API (for preview)
 */
export async function fetchGeometryJson(
  payload: Omit<CityweftPayload, 'export' | 'requestId' | 'timestamp'>,
  apiKey: string
): Promise<GeometryResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        polygon: payload.polygon,
        settings: {
          ...payload.settings,
          // Override export settings for JSON response
          topographyReturnType: payload.settings.topographyModel ? 'elevationMap' : null
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Geometry fetch error:', error);
    throw new Error(error.message || 'Failed to fetch geometry');
  }
}

/**
 * Request download URL from Cityweft API
 */
export async function requestCityweftData(
  payload: CityweftPayload,
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    const data = await response.json();

    // The API returns download URL
    if (!data.downloadUrl && !data.url) {
      throw new Error('No download URL in response');
    }

    return data.downloadUrl || data.url;
  } catch (error: any) {
    console.error('API request error:', error);
    throw new Error(error.message || 'Failed to request data from Cityweft');
  }
}

/**
 * Download file from URL
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error: any) {
    console.error('Download error:', error);
    throw new Error(error.message || 'Failed to download file');
  }
}

/**
 * Reverse geocode coordinates to get address
 */
export async function reverseGeocode(lat: number, lon: number): Promise<{ shortName: string, fullName: string } | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`);
    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }
    const data = await response.json();

    // Construct a meaningful name
    const address = data.address;
    if (!address) return null;

    const city = address.city || address.town || address.village || address.municipality;
    const country = address.country;
    let shortName = city || data.display_name?.split(',')[0] || 'Unknown Location';
    let fullName = data.display_name || shortName;

    if (city && country) {
      fullName = `${city}, ${country}`;
    }

    return { shortName, fullName };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}
