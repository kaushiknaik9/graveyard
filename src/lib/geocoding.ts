/**
 * Real Reverse Geocoding Engine
 * Uses the free OpenStreetMap Nominatim API with compliant User-Agent headers,
 * caching, and intelligent geographic fallbacks.
 */

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  street?: string;
  suburb?: string;
  neighbourhood?: string;
  residential?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
}

// In-memory cache to prevent redundant lookups for similar coordinates (15m radius)
const geoCache = new Map<string, string>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Performs reverse geocoding to convert raw GPS coordinates into a clean,
 * human-readable street address.
 * 
 * Example return: "Vidya Nagar Main Rd, Hubballi, Karnataka"
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng);
  if (geoCache.has(key)) {
    return geoCache.get(key)!;
  }

  const fallbackAddress = generateFallbackAddress(lat, lng);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'ForgeCivic-RoadSafety/1.0 (civic-incident-dispatcher@forgecivic.org)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Nominatim Warning] HTTP ${response.status} ${response.statusText}`);
      return fallbackAddress;
    }

    const data: NominatimResponse = await response.json();
    
    if (data.error || !data.address) {
      return fallbackAddress;
    }

    const addr = data.address;

    // Build specific-to-general location parts
    const street = addr.road || addr.pedestrian || addr.street || addr.residential || '';
    const locality = addr.suburb || addr.neighbourhood || addr.city_district || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const state = addr.state || '';

    const parts: string[] = [];
    if (street) parts.push(street);
    if (locality && locality !== street) parts.push(locality);
    if (city && city !== locality) parts.push(city);
    if (state && !city.includes(state) && parts.length < 3) parts.push(state);

    let formatted = parts.join(', ');

    if (!formatted.trim()) {
      formatted = data.display_name?.split(',').slice(0, 3).join(',').trim() || fallbackAddress;
    }

    geoCache.set(key, formatted);
    return formatted;
  } catch (err: any) {
    console.warn('[Geocoding Notice] Network timeout or lookup failed, using geometric coordinate label:', err.message);
    return fallbackAddress;
  }
}

/**
 * Deterministic coordinate fallback when geocoding service is unavailable
 */
function generateFallbackAddress(lat: number, lng: number): string {
  // Check if roughly in Hubballi-Dharwad bounding box (15.2 to 15.6 N, 74.9 to 75.3 E)
  const isHDMC = lat >= 15.2 && lat <= 15.6 && lng >= 74.9 && lng <= 75.3;
  const regionTag = isHDMC ? 'Hubballi-Dharwad Metro' : 'Municipal Corridor';
  
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `Near ${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir} (${regionTag})`;
}

