import { WardJurisdiction } from '../types';

/**
 * Calculates distance between two latitude/longitude points in kilometers
 * using the spherical Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (angle: number) => (angle * Math.PI) / 180;
  const R = 6371; // Earth radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Real Municipal Corporation Engineering Divisions & Ward Inspector Offices
 * Modeled for the Hubballi-Dharwad Municipal Corporation (HDMC) & expandable
 * to any municipal corporation nationwide.
 */
export const MUNICIPAL_WARD_OFFICES: WardJurisdiction[] = [
  {
    zoneId: 'HDMC-ZONE-1',
    zoneName: 'Zone 1 (Central Hubballi)',
    wardNumber: 34,
    wardName: 'Durgadbail & Lamington Ward',
    officeName: 'Zone 1 Engineering Works Department',
    officeAddress: 'HDMC Main Building, Lamington Road, Hubballi 580020',
    engineerInCharge: 'Executive Engineer M. S. Patil',
    hotline: '+91 836-2213888',
    latitude: 15.3524,
    longitude: 75.1388,
  },
  {
    zoneId: 'HDMC-ZONE-2',
    zoneName: 'Zone 2 (Vidyanagar & KLE Tech)',
    wardNumber: 22,
    wardName: 'Vidyanagar & Shirur Park Ward',
    officeName: 'Zone 2 Highway Infrastructure Sub-Division',
    officeAddress: 'PB Road, Near BVB College, Vidyanagar, Hubballi 580031',
    engineerInCharge: 'Assistant Executive Engineer R. K. Hegde',
    hotline: '+91 836-2374112',
    latitude: 15.3647,
    longitude: 75.1240,
  },
  {
    zoneId: 'HDMC-ZONE-3',
    zoneName: 'Zone 3 (Gokul Road & Airport Industrial)',
    wardNumber: 15,
    wardName: 'Gokul Industrial Corridor Ward',
    officeName: 'Zone 3 Road Quality & Asphalt Testing Depot',
    officeAddress: 'Gokul Road, Industrial Estate Stage 2, Hubballi 580030',
    engineerInCharge: 'Ward Inspector Anand Kulkarni',
    hotline: '+91 836-2331560',
    latitude: 15.3610,
    longitude: 75.0875,
  },
  {
    zoneId: 'HDMC-ZONE-4',
    zoneName: 'Zone 4 (Old Town Dharwad)',
    wardNumber: 48,
    wardName: 'Court Circle & Jubilee Circle Ward',
    officeName: 'Dharwad Administrative Road Maintenance Wing',
    officeAddress: 'PB Road, Near DC Office, Dharwad 580001',
    engineerInCharge: 'Assistant Engineer S. B. Desai',
    hotline: '+91 836-2448920',
    latitude: 15.4589,
    longitude: 75.0078,
  },
  {
    zoneId: 'HDMC-ZONE-5',
    zoneName: 'Zone 5 (Navanagar Twin-City)',
    wardNumber: 29,
    wardName: 'Navanagar Central & KSRTC Depot Ward',
    officeName: 'Navanagar Rapid Asphalt Response Team',
    officeAddress: 'Sector 4, Near High Court Bench, Navanagar 580025',
    engineerInCharge: 'Chief Road Inspector Vinay Shettar',
    hotline: '+91 836-2223901',
    latitude: 15.4095,
    longitude: 75.0645,
  },
  {
    zoneId: 'HDMC-ZONE-6',
    zoneName: 'Zone 6 (Keshwapur & Railway Colony)',
    wardNumber: 18,
    wardName: 'Keshwapur & Kusugal Road Ward',
    officeName: 'Zone 6 Municipal Engineering Bureau',
    officeAddress: 'Kusugal Road, Near Railway Hospital, Keshwapur, Hubballi 580023',
    engineerInCharge: 'Assistant Engineer Prakash Nayak',
    hotline: '+91 836-2268744',
    latitude: 15.3685,
    longitude: 75.1550,
  },
];

/**
 * Matches raw coordinates to the closest responsible Municipal Ward Division
 * using deterministic distance calculations.
 */
export function matchJurisdiction(lat: number, lon: number): WardJurisdiction {
  let closestOffice = MUNICIPAL_WARD_OFFICES[0];
  let minDistance = Infinity;

  for (const office of MUNICIPAL_WARD_OFFICES) {
    const dist = haversineDistanceKm(lat, lon, office.latitude, office.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestOffice = office;
    }
  }

  return {
    ...closestOffice,
    distanceKm: Math.round(minDistance * 10) / 10,
  };
}

/**
 * Formats a clean assignment string for citizen cards and municipal dockets.
 * Example: "Assigned: Zone 2 (Vidyanagar & KLE Tech) • 1.4 km away"
 */
export function formatAssignmentBanner(lat: number, lon: number): string {
  const match = matchJurisdiction(lat, lon);
  return `Assigned: ${match.zoneName} • ${match.distanceKm} km away`;
}

