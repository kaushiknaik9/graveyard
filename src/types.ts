export interface Pothole {
  id: string;
  photoUrl: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'severe';
  timestamp: string;
  confirmationCount: number;
  status: 'pending' | 'acknowledged' | 'repaired';
  reportedBy: string;
}

export interface VerificationResult {
  isRoadHazard: boolean;
  severity: 'low' | 'medium' | 'severe';
  confidence: number;
}

export interface WardInfo {
  name: string;
  distanceKm: number;
}
